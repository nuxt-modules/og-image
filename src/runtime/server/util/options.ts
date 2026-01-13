import type { DefineOgImageInput, OgImageOptions, OgImagePrebuilt } from '../../types'
import { componentNames } from '#og-image-virtual/component-names.mjs'
import { createError } from 'h3'

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
  // check if using a community template - must be ejected for production
  const resolved = componentNames.find((c: any) => c.pascalName === options.component)
  if (resolved?.category === 'community') {
    const msg = `Community template "${resolved.pascalName}" must be ejected before production use. Run: npx nuxt-og-image eject ${resolved.pascalName}`
    if (import.meta.dev)
      console.warn(`[nuxt-og-image] ${msg}`)
    else
      throw createError({ statusCode: 500, message: msg })
  }
  return options
}
