import { type Resolver, useNuxt } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { applyNitroPresetCompatibility } from '../compatibility'
import type { ModuleOptions } from '../module'

// we don't need any of the runtime dependencies when we use nuxt generate
// same as dev but we inject the aliases into the prerender config and noop the regular nitro
export function setupGenerateHandler(options: ModuleOptions, resolve: Resolver['resolve'], nuxt: Nuxt = useNuxt()) {
  nuxt.hooks.hook('nitro:config', async (nitroConfig) => {
    // renderers
    nitroConfig.alias!['#nuxt-og-image/renderers/satori'] = 'unenv/runtime/mock/empty'
    nitroConfig.alias!['#nuxt-og-image/renderers/chromium'] = 'unenv/runtime/mock/empty'
    // bindings
    applyNitroPresetCompatibility(nitroConfig, {
      compatibility: {
        bindings: {
          'css-inline': false,
          'chromium': false,
          'resvg': false,
          'satori': false,
          'sharp': false,
        },
      },
      resolve,
    })
  })
}
