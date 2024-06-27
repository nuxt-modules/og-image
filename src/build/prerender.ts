import { useNuxt } from '@nuxt/kit'
import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { assertSiteConfig } from 'nuxt-site-config-kit'
import { applyNitroPresetCompatibility } from '../compatibility'
import type { ModuleOptions } from '../module'

// prerender will always be called when using nuxi generate and sometimes be used when using nuxi build

export function setupPrerenderHandler(options: ModuleOptions, resolve: Resolver['resolve'], nuxt: Nuxt = useNuxt()) {
  nuxt.hooks.hook('nitro:init', async (nitro) => {
    nitro.hooks.hook('prerender:config', async (nitroConfig) => {
      // bindings
      applyNitroPresetCompatibility(nitroConfig, { compatibility: options.compatibility?.prerender, resolve })
      // avoid wasm handling while prerendering
      nitroConfig.wasm = nitroConfig.wasm || {}
      nitroConfig.wasm.esmImport = false

      // check if there are any pages in the config, these are paths without a file extension
      const prerenderingPages = (nuxt.options.nitro.prerender?.routes || [])
        .some(r => r && (!r.includes('.') || r.includes('*')))
      prerenderingPages && assertSiteConfig('nuxt-og-image', {
        url: 'OG Image tags are required to be absolute URLs.',
      }, {
        throwError: false,
      })
    })
  })
}
