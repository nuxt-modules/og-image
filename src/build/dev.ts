import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from '../module'
import type { RendererType, RuntimeCompatibilityMeta } from '../runtime/types'
import { useNuxt } from '@nuxt/kit'
import { applyNitroPresetCompatibility, getPresetNitroPresetCompatibility, resolveOgImagePreset } from '../compatibility'
import { getMissingDependencies, getRecommendedBinding } from '../utils/dependencies'

// we need all of the runtime dependencies when using build
export async function setupDevHandler(options: ModuleOptions, resolve: Resolver, getDetectedRenderers: () => Set<RendererType>, getCompatibilityMeta: () => RuntimeCompatibilityMeta = () => ({}), nuxt: Nuxt = useNuxt()) {
  // In dev, expand detected renderers to include any with installed dependencies
  // This allows community templates to work for any renderer the user has deps for
  const detectedRenderers = new Set(getDetectedRenderers())
  const targetCompatibility = getPresetNitroPresetCompatibility(resolveOgImagePreset(nuxt.options.nitro))
  for (const renderer of (['satori', 'takumi', 'browser'] as const)) {
    if (!detectedRenderers.has(renderer)) {
      const binding = getRecommendedBinding(renderer, targetCompatibility)
      const missing = await getMissingDependencies(renderer, binding)
      if (missing.length === 0)
        detectedRenderers.add(renderer)
    }
  }
  await applyNitroPresetCompatibility(nuxt.options.nitro, { compatibility: options.compatibility?.dev, resolve, detectedRenderers, metadata: getCompatibilityMeta() })
}
