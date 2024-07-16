import { useNuxt } from '@nuxt/kit'
import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { applyNitroPresetCompatibility } from '../compatibility'
import type { ModuleOptions } from '../module'

// we need all of the runtime dependencies when using build
export function setupDevHandler(options: ModuleOptions, resolve: Resolver['resolve'], nuxt: Nuxt = useNuxt()) {
  nuxt.hooks.hook('nitro:config', async (nitroConfig) => {
    await applyNitroPresetCompatibility(nitroConfig, { compatibility: options.compatibility?.dev, resolve })
  })
}
