// @ts-expect-error untyped
import { componentNames } from '#nuxt-og-image/component-names.mjs'
import type { DefineOgImageInput, OgImageOptions, OgImagePrebuilt } from '../../types'

export function normaliseOptions(_options: DefineOgImageInput): OgImageOptions | OgImagePrebuilt {
  const options = { ..._options } as OgImageOptions
  if (!options)
    return options
  // try and fix component name if we're using a shorthand (i.e Banner instead of OgImageBanner)
  if (options.component && componentNames) {
    const originalName = options.component
    for (const component of componentNames) {
      if (component.pascalName.endsWith(originalName) || component.kebabName.endsWith(originalName)) {
        options.component = component.pascalName
        break
      }
    }
  }
  else if (!options.component) {
    // just pick first component
    options.component = componentNames[0]?.pascalName
  }
  return options
}
