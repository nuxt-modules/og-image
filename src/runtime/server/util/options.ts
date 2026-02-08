import type { DefineOgImageInput, OgImageComponent, OgImageOptions, OgImagePrebuilt, RendererType } from '../../types'
import { componentNames } from '#og-image-virtual/component-names.mjs'
import { createError } from 'h3'

export interface NormalisedOptions {
  options: OgImageOptions | OgImagePrebuilt
  renderer: RendererType
  component?: OgImageComponent
}

const RENDERER_SUFFIXES = ['satori', 'browser', 'takumi'] as const

/**
 * Parse a user-provided component name into base name + renderer.
 * Supports: 'Banner.satori', 'BannerSatori', 'Banner'
 */
function parseInputName(name: string): { baseName: string, renderer: RendererType | null } {
  for (const suffix of RENDERER_SUFFIXES) {
    if (name.endsWith(`.${suffix}`))
      return { baseName: name.slice(0, -(suffix.length + 1)), renderer: suffix }
  }
  for (const suffix of RENDERER_SUFFIXES) {
    const pascal = suffix.charAt(0).toUpperCase() + suffix.slice(1)
    if (name.endsWith(pascal))
      return { baseName: name.slice(0, -pascal.length), renderer: suffix }
  }
  return { baseName: name, renderer: null }
}

/**
 * Strip renderer suffix from a PascalCase component name.
 */
function stripRenderer(name: string): string {
  return name
    .replace(/\.?(satori|browser|takumi)$/i, '')
    .replace(/(Satori|Browser|Takumi)$/, '')
}

/**
 * Known OgImage directory prefixes and their last PascalCase word.
 * Nuxt deduplicates when a filename starts with the last word(s) of the directory prefix,
 * so we need to account for that when matching user input to registered names.
 */
const OGIMAGE_PREFIXES = [
  { prefix: 'OgImageCommunity', overlapWord: 'Community' },
  { prefix: 'OgImageTemplate', overlapWord: 'Template' },
  { prefix: 'OgImage', overlapWord: 'Image' },
] as const

/**
 * Get all possible base names for a registered component.
 * Returns multiple candidates to handle Nuxt's PascalCase word deduplication
 * between directory prefix and filename.
 *
 * e.g. OgImageTestSatori → ['Test', 'ImageTest']
 *   because 'ImageTest.satori.vue' in OgImage/ gets deduplicated to OgImageTestSatori
 */
function getComponentBaseNames(component: OgImageComponent): string[] {
  const names: string[] = []
  const stripped = stripRenderer(component.pascalName)

  for (const { prefix, overlapWord } of OGIMAGE_PREFIXES) {
    if (!stripped.startsWith(prefix))
      continue
    const withoutPrefix = stripped.slice(prefix.length)
    if (withoutPrefix) {
      names.push(withoutPrefix)
      // Account for Nuxt deduplication: if the filename started with the overlap word,
      // Nuxt would have merged it with the prefix, so re-prepend it as an alternative.
      if (withoutPrefix !== overlapWord)
        names.push(overlapWord + withoutPrefix)
    }
    else {
      names.push(overlapWord)
    }
    break
  }

  // If no known prefix matched, use the full name minus renderer
  if (names.length === 0)
    names.push(stripped)

  return names
}

/**
 * Find components matching a user-provided name.
 */
function resolveComponent(name: string): { component: OgImageComponent, renderer: RendererType } {
  // First check for exact match against registered component pascalNames
  const exactMatch = componentNames.find((c: OgImageComponent) => c.pascalName === name)
  if (exactMatch)
    return { component: exactMatch, renderer: exactMatch.renderer }

  const { baseName, renderer } = parseInputName(name)

  // Also strip OgImage prefix from baseName for matching (handles OgImageCustomFonts → CustomFonts)
  const strippedBaseName = baseName.replace(/^OgImage/, '')

  // find all components whose base name matches (supports shorthand like 'Banner' matching 'OgImageBannerSatori')
  const matches = componentNames.filter((c: OgImageComponent) => {
    const baseNames = getComponentBaseNames(c)
    return baseNames.some(cBase =>
      cBase === baseName
      || cBase === strippedBaseName
      || cBase === `OgImage${baseName}`
      || cBase === `OgImage${strippedBaseName}`,
    )
  })

  // filter by renderer if specified
  const filtered = renderer
    ? matches.filter((c: OgImageComponent) => c.renderer === renderer)
    : matches

  if (filtered.length === 0) {
    if (renderer && matches.length > 0) {
      const available = matches.map((c: OgImageComponent) => `${getComponentBaseNames(c)[0]}.${c.renderer}`).join(', ')
      throw createError({
        statusCode: 500,
        message: `[Nuxt OG Image] Component "${name}" not found. Available variants: ${available}`,
      })
    }
    throw createError({
      statusCode: 500,
      message: `[Nuxt OG Image] Component "${name}" not found. Create a component in components/OgImage/ with a renderer suffix (e.g., ${baseName}.satori.vue)`,
    })
  }

  // When multiple renderers match and no renderer specified, pick the first one
  // (e.g., 'NuxtSeo' matches both NuxtSeoSatori and NuxtSeoTakumi — use first)
  const resolved = filtered[0]
  return { component: resolved, renderer: resolved.renderer }
}

export function normaliseOptions(_options: DefineOgImageInput): NormalisedOptions {
  const options = { ..._options } as OgImageOptions

  // Special case: PageScreenshot is a virtual component for page screenshots
  // It always uses browser renderer and doesn't need a real component
  if (options.component === 'PageScreenshot') {
    return {
      options,
      renderer: options.renderer || 'browser',
      component: undefined,
    }
  }

  if (!componentNames?.length) {
    throw createError({
      statusCode: 500,
      message: `[Nuxt OG Image] No OG Image components found. Create a component in components/OgImage/ with a renderer suffix (e.g., Default.satori.vue)`,
    })
  }

  // resolve component
  let resolved: OgImageComponent
  let renderer: RendererType

  if (options.component) {
    const result = resolveComponent(options.component)
    resolved = result.component
    renderer = result.renderer
  }
  else {
    // no component specified — use first registered
    resolved = componentNames[0]
    renderer = resolved.renderer
  }

  options.component = resolved.pascalName

  // check if using a community template - auto-ejected in dev, error in prod
  if (resolved.category === 'community') {
    if (!import.meta.dev) {
      throw createError({
        statusCode: 500,
        message: `Community template "${resolved.pascalName}" must be ejected before production use. Run: npx nuxt-og-image eject ${resolved.pascalName}`,
      })
    }
  }

  return {
    options,
    renderer,
    component: resolved,
  }
}
