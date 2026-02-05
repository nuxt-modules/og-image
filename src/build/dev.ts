import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from '../module'
import type { RendererType } from '../runtime/types'
import { useNuxt } from '@nuxt/kit'
import { applyNitroPresetCompatibility, getPresetNitroPresetCompatibility, resolveNitroPreset } from '../compatibility'
import { getMissingDependencies, getRecommendedBinding } from '../utils/dependencies'

// we need all of the runtime dependencies when using build
export function setupDevHandler(options: ModuleOptions, resolve: Resolver, getDetectedRenderers: () => Set<RendererType>, nuxt: Nuxt = useNuxt()) {
  // Apply renderer compatibility in nitro:init (fires AFTER components:extend)
  nuxt.hooks.hook('nitro:init', async (nitro) => {
    // In dev, expand detected renderers to include any with installed dependencies
    // This allows community templates to work for any renderer the user has deps for
    const detectedRenderers = new Set(getDetectedRenderers())
    const targetCompatibility = getPresetNitroPresetCompatibility(resolveNitroPreset(nitro.options))
    for (const renderer of (['satori', 'takumi', 'chromium'] as const)) {
      if (!detectedRenderers.has(renderer)) {
        const binding = getRecommendedBinding(renderer, targetCompatibility)
        const missing = await getMissingDependencies(renderer, binding)
        if (missing.length === 0)
          detectedRenderers.add(renderer)
      }
    }
    await applyNitroPresetCompatibility(nitro.options, { compatibility: options.compatibility?.dev, resolve, detectedRenderers })
  })
}
