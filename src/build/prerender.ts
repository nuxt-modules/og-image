import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from '../module'
import { useNuxt } from '@nuxt/kit'
import { applyNitroPresetCompatibility } from '../compatibility'

// prerender will always be called when using nuxi generate and sometimes be used when using nuxi build

export function setupPrerenderHandler(options: ModuleOptions, resolve: Resolver, nuxt: Nuxt = useNuxt()) {
  nuxt.hooks.hook('nitro:init', async (nitro) => {
    nitro.hooks.hook('prerender:config', async (nitroConfig) => {
      // bindings
      await applyNitroPresetCompatibility(nitroConfig, { compatibility: options.compatibility?.prerender, resolve })
      // avoid wasm handling while prerendering
      nitroConfig.wasm = nitroConfig.wasm || {}
      nitroConfig.wasm.esmImport = false
    })
  })
}
