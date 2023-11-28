import { type Resolver, useNuxt } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { applyNitroPresetCompatibility } from '../compatibility'
import type { ModuleOptions } from '../module'

// we need all of the runtime dependencies when using build
export function setupDevHandler(options: ModuleOptions, resolve: Resolver['resolve'], nuxt: Nuxt = useNuxt()) {
  nuxt.hooks.hook('nitro:config', async (nitroConfig) => {
    // renderers
    nitroConfig.alias!['#nuxt-og-image/renderers/satori'] = options.runtimeSatori ? resolve('./runtime/core/renderers/satori') : 'unenv/runtime/mock/empty'
    nitroConfig.alias!['#nuxt-og-image/renderers/chromium'] = options.runtimeBrowser ? resolve('./runtime/core/renderers/chromium') : 'unenv/runtime/mock/empty'

    applyNitroPresetCompatibility(nitroConfig, { resolve })
  })
}
