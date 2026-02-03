import type { H3Event } from 'h3'
import type { FontConfig, SatoriFontConfig } from '../../types'
import { resolve } from '#og-image-virtual/public-assets.mjs'
import { fontRequirements } from '#og-image/font-requirements'
import resolvedFonts from '#og-image/fonts'
import { fontCache } from './cache/lru'

export interface LoadFontsOptions {
  supportsWoff2: boolean
}

async function loadFont(event: H3Event, font: FontConfig): Promise<BufferSource | null> {
  // Include src in cache key to differentiate font subsets (e.g. latin vs cyrillic)
  const cacheKey = `${font.family}-${font.weight}-${font.style}-${font.src}`
  const cached = await fontCache.getItem(cacheKey)
  if (cached) {
    // Decode base64 back to Buffer
    const data = Buffer.from(cached, 'base64')
    return data
  }
  const data = await resolve(event, font).catch((err) => {
    console.warn(`[nuxt-og-image] Failed to load font ${font.family}: ${err.message}`)
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
  const fonts = (resolvedFonts as FontConfig[]).filter((f) => {
    // Filter by WOFF2 support
    if (!options.supportsWoff2 && f.src.endsWith('.woff2'))
      return false

    // Filter by detected font requirements
    return fontMatchesRequirements(f, fontRequirements)
  })

  const results = await Promise.all(
    fonts.map(async (f) => {
      const data = await loadFont(event, f)
      if (!data)
        return null
      return {
        ...f,
        name: f.family,
        cacheKey: `${f.family}-${f.weight}-${f.style}-${f.src}`,
        data,
      } satisfies SatoriFontConfig
    }),
  )
  return results.filter((f): f is SatoriFontConfig => f !== null)
}
