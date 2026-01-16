import type { DefineOgImageInput, OgImageComponent, OgImageOptions, OgImagePrebuilt, RendererType } from '../../types'
import { componentNames } from '#og-image-virtual/component-names.mjs'
import { createError } from 'h3'

export interface NormalisedOptions {
  options: OgImageOptions | OgImagePrebuilt
  renderer: RendererType
  component?: OgImageComponent
}

export function normaliseOptions(_options: DefineOgImageInput): NormalisedOptions {
  const options = { ..._options } as OgImageOptions
  let resolved: OgImageComponent | undefined

  // Special case: PageScreenshot is a virtual component for page screenshots
  // It always uses chromium renderer and doesn't need a real component
  if (options.component === 'PageScreenshot') {
    return {
      options,
      renderer: options.renderer || 'chromium',
      component: undefined,
    }
  }

  // try and fix component name if we're using a shorthand (i.e Banner instead of OgImageBanner)
  if (options.component && componentNames) {
    const originalName = options.component
    for (const component of componentNames) {
      // Strip renderer suffix for matching (e.g., OgImageComplexTestSatori -> OgImageComplexTest)
      const basePascalName = component.pascalName.replace(/(Satori|Chromium|Takumi)$/, '')
      const baseKebabName = component.kebabName.replace(/-(satori|chromium|takumi)$/, '')
      if (basePascalName.endsWith(originalName) || baseKebabName.endsWith(originalName)) {
        options.component = component.pascalName
        resolved = component
        break
      }
    }
  }

  if (!resolved && options.component) {
    resolved = componentNames.find((c: OgImageComponent) => c.pascalName === options.component)
  }

  if (!resolved) {
    // pick first component
    resolved = componentNames[0]
    options.component = resolved?.pascalName
  }

  if (!resolved) {
    throw createError({
      statusCode: 500,
      message: `[Nuxt OG Image] No OG Image components found. Create a component in components/OgImage/ with a renderer suffix (e.g., Default.satori.vue)`,
    })
  }

  // check if using a community template - must be ejected for production
  if (resolved.category === 'community') {
    const msg = `Community template "${resolved.pascalName}" must be ejected before production use. Run: npx nuxt-og-image eject ${resolved.pascalName}`
    if (import.meta.dev)
      console.warn(`[nuxt-og-image] ${msg}`)
    else
      throw createError({ statusCode: 500, message: msg })
  }

  // Use explicit renderer override if provided (internal use), otherwise from component
  const renderer = options.renderer || resolved.renderer

  return {
    options,
    renderer,
    component: resolved,
  }
}
