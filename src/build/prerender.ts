import { type Resolver, addServerPlugin, useNuxt } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { applyNitroPresetCompatibility } from '../compatibility'
import type { ModuleOptions } from './module'

// prerender will always be called when using nuxi generate and sometimes be used when using nuxi build

export function setupPrerenderHandler(options: ModuleOptions, resolve: Resolver['resolve'], nuxt: Nuxt = useNuxt()) {
  // TODO maybe remove
  addServerPlugin(resolve('./runtime/nitro/plugins/prerender.ts'))
  nuxt.hooks.hook('nitro:init', async (nitro) => {
    nitro.hooks.hook('prerender:config', async (nitroConfig) => {
      // renderers
      nitroConfig.alias!['#nuxt-og-image/renderers/satori'] = resolve('./runtime/core/renderers/satori')
      nitroConfig.alias!['#nuxt-og-image/renderers/chromium'] = resolve('./runtime/core/renderers/chromium')
      // bindings
      applyNitroPresetCompatibility(nitroConfig, { resolve })
      // avoid wasm handling while prerendering
      nitroConfig.wasm = nitroConfig.wasm || {}
      nitroConfig.wasm.esmImport = false
    })
  })
}
