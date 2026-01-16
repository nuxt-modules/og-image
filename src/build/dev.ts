import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from '../module'
import type { RendererType } from '../runtime/types'
import { useNuxt } from '@nuxt/kit'
import { applyNitroPresetCompatibility } from '../compatibility'

// we need all of the runtime dependencies when using build
export function setupDevHandler(options: ModuleOptions, resolve: Resolver, getDetectedRenderers: () => Set<RendererType>, nuxt: Nuxt = useNuxt()) {
  // Apply renderer compatibility in nitro:init (fires AFTER components:extend)
  nuxt.hooks.hook('nitro:init', async (nitro) => {
    await applyNitroPresetCompatibility(nitro.options, { compatibility: options.compatibility?.dev, resolve, detectedRenderers: getDetectedRenderers() })
  })
}
