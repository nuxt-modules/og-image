import type { H3Event } from 'h3'
import type { FontConfig, SatoriFontConfig } from '../../types'
import { resolve } from '#og-image-virtual/public-assets.mjs'
import { componentFontMap, fontRequirements } from '#og-image/font-requirements'
import resolvedFonts from '#og-image/fonts'
import { logger } from '../../logger'
import { fontCache } from './cache/lru'

export interface LoadFontsOptions {
  /**
   * Whether the renderer supports WOFF2.
   * When false, WOFF2 fonts will use satoriSrc (converted TTF) if available,
   * otherwise they will be skipped.
   */
  supportsWoff2: boolean
  /** Component pascalName — filters fonts to only what this component needs */
  component?: string
}

async function loadFont(event: H3Event, font: FontConfig, src: string): Promise<BufferSource | null> {
  // Include src in cache key to differentiate font subsets (e.g. latin vs cyrillic)
  const cacheKey = `${font.family}-${font.weight}-${font.style}-${src}`
  const cached = await fontCache.getItem(cacheKey)
  if (cached) {
    // Decode base64 back to Buffer
    const data = Buffer.from(cached, 'base64')
    return data
  }
  const data = await resolve(event, { ...font, src }).catch((err) => {
    // Suppress 404 warnings for converted TTF fonts - these are intentionally deleted
    // for variable fonts (which would crash Satori's opentype.js parser)
    const is404OnTtf = src.endsWith('.ttf') && (err.message?.includes('404') || err.message?.includes('not found'))
    if (!is404OnTtf) {
      logger.warn(`Failed to load font ${font.family}: ${err.message}`)
    }
    return null
  })
  if (!data)
    return null
  // Encode as base64 for storage to avoid LRU cache serialization issues
  const base64 = Buffer.from(data as Buffer).toString('base64')
  await fontCache.setItem(cacheKey, base64)
  return data
}

/**
 * Check if a font matches the detected requirements.
 * For variable fonts (weight ranges), checks if any required weight is in range.
 */
function fontMatchesRequirements(font: FontConfig, requirements: typeof fontRequirements): boolean {
  // If analysis was incomplete, load all fonts as fallback
  if (!requirements.isComplete)
    return true

  // Check style match
  if (!requirements.styles.includes(font.style as 'normal' | 'italic'))
    return false

  // Check weight match
  // Note: font.weight is already normalized to a single value in module.ts
  // For variable fonts, the weight is set to 400 if in range, otherwise min
  return requirements.weights.includes(font.weight)
}

export async function loadAllFonts(event: H3Event, options: LoadFontsOptions): Promise<SatoriFontConfig[]> {
  const componentReqs = options.component ? (componentFontMap as Record<string, typeof fontRequirements>)[options.component] : null
  const reqs = (componentReqs && componentReqs.isComplete) ? componentReqs : fontRequirements
  const fonts = (resolvedFonts as FontConfig[]).filter(f => fontMatchesRequirements(f, reqs))

  const results = await Promise.all(
    fonts.map(async (f) => {
      let src = f.src
      const isWoff2 = f.src.endsWith('.woff2')

      if (!options.supportsWoff2 && isWoff2) {
        // For renderers that don't support WOFF2 (like Satori),
        // use converted TTF if available, otherwise skip this font
        if (f.satoriSrc) {
          src = f.satoriSrc
        }
        else {
          // No converted TTF available, skip WOFF2 font
          return null
        }
      }

      const data = await loadFont(event, f, src)
      if (!data)
        return null
      return {
        ...f,
        name: f.family,
        cacheKey: `${f.family}-${f.weight}-${f.style}-${src}`,
        data,
      } satisfies SatoriFontConfig
    }),
  )
  return results.filter((f): f is SatoriFontConfig => f !== null)
}
