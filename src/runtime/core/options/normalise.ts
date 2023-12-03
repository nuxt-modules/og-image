import type { DefineOgImageInput, OgImageOptions, OgImagePrebuilt } from '../../types'
import { useOgImageRuntimeConfig } from '../../utils'
import { unref } from '#imports'

// @ts-expect-error untyped
import { componentNames } from '#build/og-image-component-names.mjs'

export function normaliseOptions(_options: DefineOgImageInput): OgImageOptions | OgImagePrebuilt {
  const { runtimeSatori } = useOgImageRuntimeConfig()
  const options = { ...unref(_options) }
  // support deprecations
  if (options.static)
    options.cache = options.cache || options.static
  if (options.provider === 'satori')
    options.renderer = options.renderer || 'satori'
  else if (options.provider === 'browser')
    options.renderer = options.renderer || 'chromium'
  options.renderer = options.renderer || 'satori'
  if (options.renderer === 'satori' && !runtimeSatori)
    options.renderer = 'chromium'
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
