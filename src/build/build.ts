import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from '../module'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolvePath, useNuxt } from '@nuxt/kit'
import { dirname } from 'pathe'
import { applyNitroPresetCompatibility, getPresetNitroPresetCompatibility, resolveNitroPreset } from '../compatibility'
import { gray, logger } from '../logger'

// we need all of the runtime dependencies when using build
export async function setupBuildHandler(config: ModuleOptions, resolve: Resolver['resolve'], nuxt: Nuxt = useNuxt()) {
  nuxt.options.nitro.storage = nuxt.options.nitro.storage || {}
  if (typeof config.runtimeCacheStorage === 'object')
    nuxt.options.nitro.storage['og-image'] = config.runtimeCacheStorage

  nuxt.hooks.hook('nitro:config', async (nitroConfig) => {
    await applyNitroPresetCompatibility(nitroConfig, { compatibility: config.compatibility?.runtime, resolve })
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
      const serverEntry = resolve(_nitro.options.output.serverDir, typeof configuredEntry === 'string'
        ? configuredEntry
        : 'index.mjs')
      const wasmEntries = [serverEntry]
      const isCloudflarePagesOrModule = target === 'cloudflare-pages' || target === 'cloudflare-module'
      if (isCloudflarePagesOrModule) {
        // this is especially hacky, basically need to add all paths the wasm import can exist on
        // TODO maybe implement https://github.com/pi0/nuxt-shiki/blob/50e80fb6454de561e667630b4e410d2f7b5f2d35/src/module.ts#L103-L128
        wasmEntries.push(resolve(dirname(serverEntry), './chunks/wasm.mjs'))
        wasmEntries.push(resolve(dirname(serverEntry), './chunks/_/wasm.mjs'))
        wasmEntries.push(resolve(dirname(serverEntry), './chunks/index_bg.mjs'))
        // we need to modify the _routes.json as og image adds to many
        const routesPath = resolve(nitro.options.output.publicDir, '_routes.json')
        const routes: { version: number, include: string[], exclude: string[] } = await readFile(routesPath)
          .then(buffer => JSON.parse(buffer.toString()))

        const preSize = routes.exclude.length
        routes.exclude = routes.exclude.filter(path => !path.startsWith('/__og-image__/static'))
        routes.exclude.push('/__og-image__/static/*')
        if (preSize !== routes.exclude.length) {
          logger.info(`Optimizing CloudFlare \`_routes.json\` for prerendered OG Images ${gray(`(${100 - Math.round(routes.exclude.length / preSize * 100)}% smaller)`)}`)
        }
        await writeFile(routesPath, JSON.stringify(routes, void 0, 2))
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
  return sha1(existsSync(_path) ? await readFile(_path) : path)
}

function sha1(source: Buffer) {
  return createHash('sha1').update(source).digest('hex').slice(0, 16)
}
