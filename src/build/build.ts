import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from '../module'
import type { RendererType } from '../runtime/types'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolvePath, useNuxt } from '@nuxt/kit'
import { dirname } from 'pathe'
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
      if (compatibility.wasm?.esmImport !== true)
        return
      const configuredEntry = nitro.options.rollupConfig?.output.entryFileNames
      const serverEntry = resolve.resolve(_nitro.options.output.serverDir, typeof configuredEntry === 'string'
        ? configuredEntry
        : 'index.mjs')
      const wasmEntries = [serverEntry]
      if (isCloudflarePagesOrModule) {
        // this is especially hacky, basically need to add all paths the wasm import can exist on
        // TODO maybe implement https://github.com/pi0/nuxt-shiki/blob/50e80fb6454de561e667630b4e410d2f7b5f2d35/src/module.ts#L103-L128
        wasmEntries.push(resolve.resolve(dirname(serverEntry), './chunks/wasm.mjs'))
        wasmEntries.push(resolve.resolve(dirname(serverEntry), './chunks/_/wasm.mjs'))
        wasmEntries.push(resolve.resolve(dirname(serverEntry), './chunks/index_bg.mjs'))
      }
      const resvgHash = await resolveFilePathSha1('@resvg/resvg-wasm/index_bg.wasm')
      const yogaHash = await resolveFilePathSha1('yoga-wasm-web/dist/yoga.wasm')
      const cssInlineHash = await resolveFilePathSha1('@css-inline/css-inline-wasm/index_bg.wasm')
      for (const entry of wasmEntries) {
        if (!existsSync(entry))
          continue
        const contents = (await readFile(serverEntry, 'utf-8'))
        const postfix = target === 'vercel-edge' ? '?module' : ''
        const path = isCloudflarePagesOrModule ? `../wasm/` : `./wasm/`
        await writeFile(serverEntry, contents
          .replaceAll('"@resvg/resvg-wasm/index_bg.wasm?module"', `"${path}index_bg-${resvgHash}.wasm${postfix}"`)
          .replaceAll('"@css-inline/css-inline-wasm/index_bg.wasm?module"', `"${path}index_bg-${cssInlineHash}.wasm${postfix}"`)
          .replaceAll('"yoga-wasm-web/dist/yoga.wasm?module"', `"${path}yoga-${yogaHash}.wasm${postfix}"`), { encoding: 'utf-8' })
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
