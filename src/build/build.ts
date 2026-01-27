import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from '../module'
import type { RendererType } from '../runtime/types'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolvePath, useNuxt } from '@nuxt/kit'
import { dirname, join } from 'pathe'
import { applyNitroPresetCompatibility, getPresetNitroPresetCompatibility, resolveNitroPreset } from '../compatibility'

// we need all of the runtime dependencies when using build
export async function setupBuildHandler(config: ModuleOptions, resolve: Resolver, getDetectedRenderers: () => Set<RendererType>, nuxt: Nuxt = useNuxt()) {
  nuxt.options.nitro.storage = nuxt.options.nitro.storage || {}
  if (typeof config.runtimeCacheStorage === 'object')
    nuxt.options.nitro.storage['nuxt-og-image'] = config.runtimeCacheStorage

  nuxt.hooks.hook('nitro:config', async (nitroConfig) => {
    // stub packages that aren't available or used on edge runtimes
    const mockCode = `import proxy from 'mocked-exports/proxy';export default proxy;export * from 'mocked-exports/proxy';`
    nitroConfig.virtual = nitroConfig.virtual || {}
    // playwright-core has many deep imports - stub the package and its deps entirely
    nitroConfig.virtual['playwright-core'] = mockCode
    nitroConfig.virtual.electron = mockCode
    nitroConfig.virtual['electron/index'] = mockCode
    nitroConfig.virtual['electron/index.js'] = mockCode
    nitroConfig.virtual.bufferutil = mockCode
    nitroConfig.virtual['utf-8-validate'] = mockCode
    nitroConfig.virtual['chromium-bidi'] = mockCode
    // stub deep imports from chromium-bidi
    nitroConfig.virtual['chromium-bidi/lib/cjs/bidiMapper/BidiMapper'] = mockCode
    nitroConfig.virtual['chromium-bidi/lib/cjs/bidiMapper/BidiMapper.js'] = mockCode
    // image-size dep
    nitroConfig.virtual.queue = mockCode
  })

  // Apply renderer compatibility and WASM patching in nitro:init
  nuxt.hooks.hook('nitro:init', async (nitro) => {
    // Apply renderer compatibility based on detected component suffixes
    const renderers = getDetectedRenderers()
    await applyNitroPresetCompatibility(nitro.options, { compatibility: config.compatibility?.runtime, resolve, detectedRenderers: renderers })

    // HACK: we need to patch the compiled output to fix the wasm resolutions using esmImport
    // TODO replace this once upstream is fixed
    const target = resolveNitroPreset(nitro.options)
    const normalizedTarget = target.replace(/-legacy$/, '')
    const isEdgePreset = ['cloudflare', 'cloudflare-pages', 'cloudflare-module', 'vercel-edge', 'netlify-edge'].includes(normalizedTarget)
    const isCloudflarePagesOrModule = normalizedTarget === 'cloudflare-pages' || normalizedTarget === 'cloudflare-module'
    if (isCloudflarePagesOrModule) {
      nitro.options.cloudflare = nitro.options.cloudflare || {}
      nitro.options.cloudflare.pages = nitro.options.cloudflare.pages || {}
      nitro.options.cloudflare.pages.routes = nitro.options.cloudflare.pages.routes || { exclude: [] }
      nitro.options.cloudflare.pages.routes.exclude = nitro.options.cloudflare.pages.routes.exclude || []
      nitro.options.cloudflare.pages.routes.exclude.push('/_og/s/*')
    }
    nitro.hooks.hook('compiled', async (_nitro) => {
      const compatibility = getPresetNitroPresetCompatibility(target)
      if (!isEdgePreset)
        return
      const configuredEntry = nitro.options.rollupConfig?.output.entryFileNames
      const serverEntry = join(_nitro.options.output.serverDir, typeof configuredEntry === 'string'
        ? configuredEntry
        : 'index.mjs')
      const wasmEntries = [serverEntry]
      if (isCloudflarePagesOrModule) {
        // this is especially hacky, basically need to add all paths the wasm import can exist on
        // TODO maybe implement https://github.com/pi0/nuxt-shiki/blob/50e80fb6454de561e667630b4e410d2f7b5f2d35/src/module.ts#L103-L128
        wasmEntries.push(join(dirname(serverEntry), 'chunks/wasm.mjs'))
        wasmEntries.push(join(dirname(serverEntry), 'chunks/_/wasm.mjs'))
        wasmEntries.push(join(dirname(serverEntry), 'chunks/0-15-wasm.mjs'))
        wasmEntries.push(join(dirname(serverEntry), 'chunks/_/0-15-wasm.mjs'))
        wasmEntries.push(join(dirname(serverEntry), 'chunks/index_bg.mjs'))
      }
      const resvgHash = await resolveFilePathSha1('@resvg/resvg-wasm/index_bg.wasm')
      const yogaHash = await resolveFilePathSha1('yoga-wasm-web/dist/yoga.wasm')
      const cssInlineHash = await resolveFilePathSha1('@css-inline/css-inline-wasm/index_bg.wasm')
      for (const entry of wasmEntries) {
        if (!existsSync(entry))
          continue
        let contents = (await readFile(entry, 'utf-8'))
        // Fix unenv process polyfill on Vercel Edge: Proxy + private class fields are incompatible.
        // unenv's Process class uses private fields (#stdin, #stdout, #stderr, #cwd) but the
        // process polyfill wraps it in a Proxy. Vercel Edge's minimal process object causes
        // property lookups to fall through to processModule, where `this` is the Proxy (not the
        // Process instance), causing "Cannot read private member" errors.
        // Cloudflare/Netlify Edge provide fuller process shims so the fallback path isn't hit.
        // TODO: remove once https://github.com/unjs/unenv/issues/XXX is fixed
        if (normalizedTarget === 'vercel-edge') {
          contents = contents
            .replaceAll(
              'return Reflect.get(target, prop, receiver);\n\t}\n\treturn Reflect.get(processModule, prop, receiver)',
              'return Reflect.get(target, prop, receiver);\n\t}\n\treturn Reflect.get(processModule, prop, processModule)',
            )
            // Also handle minified output (ternary: Reflect.has(E,$)?Reflect.get(E,$,ne):Reflect.get(be,$,ne))
            .replace(
              /Reflect\.has\(([\w$]+),([\w$]+)\)\?Reflect\.get\(\1,\2,([\w$]+)\):Reflect\.get\(([\w$]+),\2,\3\)/g,
              'Reflect.has($1,$2)?Reflect.get($1,$2,$3):Reflect.get($4,$2,$4)',
            )
        }
        if (compatibility.wasm?.esmImport) {
          const postfix = normalizedTarget === 'vercel-edge' ? '?module' : ''
          const wasmPath = isCloudflarePagesOrModule ? `../wasm/` : `./wasm/`
          // Try the original source import paths first (before nitro's WASM plugin resolves them)
          contents = contents
            .replaceAll('"@resvg/resvg-wasm/index_bg.wasm?module"', `"${wasmPath}index_bg-${resvgHash}.wasm${postfix}"`)
            .replaceAll('"@css-inline/css-inline-wasm/index_bg.wasm?module"', `"${wasmPath}index_bg-${cssInlineHash}.wasm${postfix}"`)
            .replaceAll('"yoga-wasm-web/dist/yoga.wasm?module"', `"${wasmPath}yoga-${yogaHash}.wasm${postfix}"`)
          // Nitro's WASM plugin may have already resolved the paths (hashed filenames, moved to wasm/).
          // For vercel-edge, append ?module to any .wasm imports that nitro already resolved.
          if (postfix) {
            contents = contents.replaceAll(/import\("(\.\/wasm\/[^"]+\.wasm)"\)/g, `import("$1${postfix}")`)
          }
        }
        await writeFile(entry, contents, { encoding: 'utf-8' })
      }
    })
  })
}

async function resolveFilePathSha1(path: string) {
  const _path = await resolvePath(path)
  return sha1(existsSync(_path) ? await readFile(_path) : Buffer.from(path))
}

function sha1(source: Buffer) {
  return createHash('sha1').update(source).digest('hex').slice(0, 16)
}
