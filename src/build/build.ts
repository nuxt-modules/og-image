import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from '../module'
import type { RendererType } from '../runtime/types'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolvePath, useNuxt } from '@nuxt/kit'
import { parseAndWalk } from 'oxc-walker'
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
    const isEdgePreset = ['cloudflare', 'cloudflare-pages', 'cloudflare-pages-static', 'cloudflare-module', 'cloudflare-durable', 'vercel-edge', 'netlify-edge'].includes(normalizedTarget)
    const isCloudflarePreset = normalizedTarget.startsWith('cloudflare')
    const isCloudflarePagesOrModule = ['cloudflare-pages', 'cloudflare-pages-static', 'cloudflare-module', 'cloudflare-durable'].includes(normalizedTarget)
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
        // Discover all wasm-related chunks — names are unpredictable (wasm.mjs, wasm2.mjs, etc.)
        const chunkDirs = [join(dirname(serverEntry), 'chunks'), join(dirname(serverEntry), 'chunks/_')]
        for (const dir of chunkDirs) {
          if (!existsSync(dir))
            continue
          const files = await readdir(dir)
          for (const f of files) {
            if (f.startsWith('wasm') && f.endsWith('.mjs'))
              wasmEntries.push(join(dir, f))
            if (f === 'index_bg.mjs')
              wasmEntries.push(join(dir, f))
          }
        }
      }
      const resvgHash = await resolveFilePathSha1('@resvg/resvg-wasm/index_bg.wasm')
      const yogaHash = await resolveFilePathSha1('satori/yoga.wasm')
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
            .replaceAll('"satori/yoga.wasm?module"', `"${wasmPath}yoga-${yogaHash}.wasm${postfix}"`)
            // Legacy: also handle yoga-wasm-web path in case it appears
            .replaceAll('"yoga-wasm-web/dist/yoga.wasm?module"', `"${wasmPath}yoga-${yogaHash}.wasm${postfix}"`)
          // Nitro's WASM plugin may have already resolved the paths (hashed filenames, moved to wasm/).
          // For vercel-edge, append ?module to any .wasm imports that nitro already resolved.
          if (postfix) {
            contents = contents.replaceAll(/import\("(\.\/wasm\/[^"]+\.wasm)"\)/g, `import("$1${postfix}")`)
          }
        }
        // HACK: Cloudflare Workers block WebAssembly.instantiate() at runtime entirely
        // (see https://github.com/vercel/satori/issues/693). The Emscripten glue in satori
        // and @resvg/resvg-wasm calls WebAssembly.instantiate(module, imports) even when
        // given a pre-compiled WebAssembly.Module. CF requires using
        // new WebAssembly.Instance(module, imports) synchronously instead.
        // TODO: remove once satori/resvg-wasm handles WebAssembly.Module natively
        if (isCloudflarePreset) {
          contents = patchWebAssemblyInstantiate(contents)
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

/**
 * Use oxc-walker to find all `WebAssembly.instantiate(wasm, imports)` calls and wrap them
 * with an instanceof check so pre-compiled WebAssembly.Module uses `new WebAssembly.Instance()`
 * (synchronous) instead of the blocked `WebAssembly.instantiate()` on Cloudflare Workers.
 *
 * Handles both `await WebAssembly.instantiate(a, b)` and bare `WebAssembly.instantiate(a, b)`
 * (e.g. inside .then() callbacks from Emscripten glue code).
 */
function patchWebAssemblyInstantiate(code: string): string {
  // Collect replacement ranges (process in reverse order to preserve offsets)
  const replacements: Array<{ start: number, end: number, arg1: string, arg2: string, isAwait: boolean }> = []
  // Track which CallExpression starts we've already captured via AwaitExpression
  const capturedCallStarts = new Set<number>()

  parseAndWalk(code, 'chunk.mjs', (node) => {
    // Match: await WebAssembly.instantiate(arg1, arg2)
    if (node.type === 'AwaitExpression') {
      const arg = node.argument
      if (arg.type !== 'CallExpression' || arg.arguments.length !== 2)
        return
      const callee = arg.callee
      if (
        callee.type !== 'MemberExpression'
        || callee.object.type !== 'Identifier'
        || callee.object.name !== 'WebAssembly'
        || callee.property.name !== 'instantiate'
      ) {
        return
      }
      const [a1, a2] = arg.arguments
      capturedCallStarts.add(arg.start)
      replacements.push({
        start: node.start,
        end: node.end,
        arg1: code.slice(a1.start, a1.end),
        arg2: code.slice(a2.start, a2.end),
        isAwait: true,
      })
      return
    }

    // Match: bare WebAssembly.instantiate(arg1, arg2) (no await)
    if (node.type === 'CallExpression' && node.arguments.length === 2) {
      const callee = node.callee
      if (
        callee.type !== 'MemberExpression'
        || callee.object.type !== 'Identifier'
        || callee.object.name !== 'WebAssembly'
        || callee.property.name !== 'instantiate'
      ) {
        return
      }
      // Skip if already captured as part of an AwaitExpression
      if (capturedCallStarts.has(node.start))
        return
      const [a1, a2] = node.arguments
      replacements.push({
        start: node.start,
        end: node.end,
        arg1: code.slice(a1.start, a1.end),
        arg2: code.slice(a2.start, a2.end),
        isAwait: false,
      })
    }
  })

  // Apply in reverse so earlier offsets stay valid
  for (const r of replacements.sort((a, b) => b.start - a.start)) {
    // Parenthesize arg1 to prevent ternary expressions from merging with instanceof
    const a1 = `(${r.arg1})`
    const patch = r.isAwait
      ? `(${a1} instanceof WebAssembly.Module`
      + `?{instance:new WebAssembly.Instance(${a1},${r.arg2}),module:${a1}}`
      + `:await WebAssembly.instantiate(${r.arg1},${r.arg2}))`
      : `(${a1} instanceof WebAssembly.Module`
        + `?Promise.resolve({instance:new WebAssembly.Instance(${a1},${r.arg2}),module:${a1}})`
        + `:WebAssembly.instantiate(${r.arg1},${r.arg2}))`
    code = code.slice(0, r.start) + patch + code.slice(r.end)
  }
  return code
}
