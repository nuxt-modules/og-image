import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ModuleOptions } from '../module'
import type { RendererType } from '../runtime/types'
import { useNuxt } from '@nuxt/kit'
import { applyNitroPresetCompatibility } from '../compatibility'

// we don't need any of the runtime dependencies when we use nuxt generate
// same as dev but we inject the aliases into the prerender config and noop the regular nitro
export function setupGenerateHandler(_options: ModuleOptions, resolve: Resolver, _getDetectedRenderers: () => Set<RendererType>, nuxt: Nuxt = useNuxt()) {
  nuxt.hooks.hook('nitro:config', async (nitroConfig) => {
    // bindings - generate mode disables all renderers (prerender handles them)
    await applyNitroPresetCompatibility(nitroConfig, {
      compatibility: {
        'browser': false,
        'satori': false,
        'css-inline': false,
        'resvg': false,
        'sharp': false,
      },
      resolve,
      detectedRenderers: new Set<RendererType>(),
    })
  })
}
