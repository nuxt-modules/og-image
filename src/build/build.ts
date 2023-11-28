import { type Resolver, useNuxt } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { applyNitroPresetCompatibility } from '../compatibility'
import type { ModuleOptions } from '../module'

// we need all of the runtime dependencies when using build
export async function setupBuildHandler(config: ModuleOptions, resolve: Resolver['resolve'], nuxt: Nuxt = useNuxt()) {
  nuxt.options.nitro.storage = nuxt.options.nitro.storage || {}
  if (typeof config.runtimeCacheStorage === 'object')
    nuxt.options.nitro.storage['og-image'] = config.runtimeCacheStorage

  nuxt.hooks.hook('nitro:config', async (nitroConfig) => {
    // renderers
    nitroConfig.alias!['#nuxt-og-image/renderers/satori'] = config.runtimeSatori ? resolve('./runtime/core/renderers/satori') : 'unenv/runtime/mock/empty'
    nitroConfig.alias!['#nuxt-og-image/renderers/chromium'] = config.runtimeBrowser ? resolve('./runtime/core/renderers/chromium') : 'unenv/runtime/mock/empty'

    applyNitroPresetCompatibility(nitroConfig, { resolve, compatibility: config.runtimeCompatibility })
    // patch implicit dependencies:
    // - playwright-core
    nitroConfig.alias.electron = 'unenv/runtime/mock/proxy-cjs'
    nitroConfig.alias.bufferutil = 'unenv/runtime/mock/proxy-cjs'
    nitroConfig.alias['utf-8-validate'] = 'unenv/runtime/mock/proxy-cjs'
    // - image-size
    nitroConfig.alias.queue = 'unenv/runtime/mock/proxy-cjs'
  })
}
