import type { OgImageOptions } from '../../types'
import { unref, useRuntimeConfig } from '#imports'

// @ts-expect-error untyped
import { componentNames } from '#build/og-image-component-names.mjs'

export function normaliseOgImageOptions(_options: OgImageOptions) {
  const options = { ...unref(_options) }
  // support deprecations
  if (options.static)
    options.cache = options.cache || options.static
  if (!options.provider)
    options.provider = 'satori'
  const { runtimeSatori } = useRuntimeConfig()['nuxt-og-image']
  if (options.provider === 'satori' && !runtimeSatori)
    options.provider = 'browser'
  // try and fix component name if we're using a shorthand (i.e Banner instead of OgImageBanner)
  if (options.component && componentNames) {
    const originalName = options.component
    for (const component of componentNames) {
      if (component.pascalName.endsWith(originalName) || component.kebabName.endsWith(originalName)) {
        options.component = component.pascalName
        options.componentHash = component.hash
        break
      }
    }
  }
  return options
}
