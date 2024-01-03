import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { type Resolver, resolvePath, useNuxt } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { dirname } from 'pathe'
import { applyNitroPresetCompatibility, getPresetNitroPresetCompatibility, resolveNitroPreset } from '../compatibility'
import type { ModuleOptions } from '../module'

// we need all of the runtime dependencies when using build
export async function setupBuildHandler(config: ModuleOptions, resolve: Resolver['resolve'], nuxt: Nuxt = useNuxt()) {
  nuxt.options.nitro.storage = nuxt.options.nitro.storage || {}
  if (typeof config.runtimeCacheStorage === 'object')
    nuxt.options.nitro.storage['og-image'] = config.runtimeCacheStorage

  nuxt.hooks.hook('nitro:config', async (nitroConfig) => {
    applyNitroPresetCompatibility(nitroConfig, { compatibility: config.compatibility?.runtime, resolve })
    // patch implicit dependencies:
    // - playwright-core
    nitroConfig.alias!.electron = 'unenv/runtime/mock/proxy-cjs'
    nitroConfig.alias!.bufferutil = 'unenv/runtime/mock/proxy-cjs'
    nitroConfig.alias!['utf-8-validate'] = 'unenv/runtime/mock/proxy-cjs'
    // - image-size
    nitroConfig.alias!.queue = 'unenv/runtime/mock/proxy-cjs'
  })

  // HACK: we need to patch the compiled output to fix the wasm resolutions using esmImport
  // TODO replace this once upstream is fixed
  nuxt.hooks.hook('nitro:init', async (nitro) => {
    nitro.hooks.hook('compiled', async (_nitro) => {
      const target = resolveNitroPreset(_nitro.options)
      const compatibility = getPresetNitroPresetCompatibility(target)
      if (compatibility.wasm?.esmImport !== true)
        return
      const configuredEntry = nitro.options.rollupConfig?.output.entryFileNames
      let serverEntry = resolve(_nitro.options.output.serverDir, typeof configuredEntry === 'string'
        ? configuredEntry
        : 'index.mjs')
      if (target === 'cloudflare-pages')
        // this is especially hacky
        serverEntry = resolve(dirname(serverEntry), './chunks/wasm.mjs')
      const contents = (await readFile(serverEntry, 'utf-8'))
      const resvgHash = sha1(await readFile(await resolvePath('@resvg/resvg-wasm/index_bg.wasm')))
      const yogaHash = sha1(await readFile(await resolvePath('yoga-wasm-web/dist/yoga.wasm')))
      const cssInlineHash = sha1(await readFile(await resolvePath('@css-inline/css-inline-wasm/index_bg.wasm')))
      const postfix = target === 'vercel-edge' ? '?module' : ''
      const path = target === 'cloudflare-pages' ? `../wasm/` : `./wasm/`
      await writeFile(serverEntry, contents
        .replaceAll('"@resvg/resvg-wasm/index_bg.wasm"', `"${path}index_bg-${resvgHash}.wasm${postfix}"`)
        .replaceAll('"@css-inline/css-inline-wasm/index_bg.wasm"', `"${path}index_bg-${cssInlineHash}.wasm${postfix}"`)
        .replaceAll('"yoga-wasm-web/dist/yoga.wasm"', `"${path}yoga-${yogaHash}.wasm${postfix}"`), { encoding: 'utf-8' })
      // TODO remove with next nitro bump
      if (target.includes('cloudflare')) {
        const imgChunk = resolve(dirname(serverEntry), './chunks/handlers/image.mjs')
        existsSync(imgChunk) && await writeFile(imgChunk, (await readFile(serverEntry, 'utf-8'))
          .replaceAll('"@resvg/resvg-wasm/index_bg.wasm"', `"${path}index_bg-${resvgHash}.wasm${postfix}"`)
          .replaceAll('"@css-inline/css-inline-wasm/index_bg.wasm"', `"${path}index_bg-${cssInlineHash}.wasm${postfix}"`)
          .replaceAll('"yoga-wasm-web/dist/yoga.wasm"', `"${path}yoga-${yogaHash}.wasm${postfix}"`), { encoding: 'utf-8' })
      }
    })
  })
}

function sha1(source: Buffer) {
  return createHash('sha1').update(source).digest('hex').slice(0, 16)
}
