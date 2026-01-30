import type { H3Event } from 'h3'
import type { FontConfig, SatoriFontConfig } from '../../types'
import { resolve } from '#og-image-virtual/public-assets.mjs'
import resolvedFonts from '#og-image/fonts'
import { fontCache } from './cache/lru'

export interface LoadFontsOptions {
  /**
   * Whether the renderer supports WOFF2.
   * When false, WOFF2 fonts will use satoriSrc (converted TTF) if available,
   * otherwise they will be skipped.
   */
  supportsWoff2: boolean
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
    const is404OnTtf = src.endsWith('.ttf') && err.message?.includes('404')
    if (!is404OnTtf) {
      console.warn(`[nuxt-og-image] Failed to load font ${font.family}: ${err.message}`)
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

export async function loadAllFonts(event: H3Event, options: LoadFontsOptions): Promise<SatoriFontConfig[]> {
  const fonts = resolvedFonts as FontConfig[]

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
