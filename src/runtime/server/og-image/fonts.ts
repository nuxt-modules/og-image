import type { H3Event } from 'h3'
import type { FontConfig, SatoriFontConfig } from '../../types'
import { resolve } from '#og-image-virtual/public-assets.mjs'
import resolvedFonts from '#og-image/fonts'
import { fontCache } from './cache/lru'

export interface LoadFontsOptions {
  supportsWoff2: boolean
}

async function loadFont(event: H3Event, font: FontConfig): Promise<BufferSource | null> {
  const cacheKey = `${font.family}-${font.weight}-${font.style}`
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

export async function loadAllFonts(event: H3Event, options: LoadFontsOptions): Promise<SatoriFontConfig[]> {
  const fonts = (resolvedFonts as FontConfig[]).filter((f) => {
    if (options.supportsWoff2)
      return true
    return !f.src.endsWith('.woff2')
  })

  const results = await Promise.all(
    fonts.map(async (f) => {
      const data = await loadFont(event, f)
      if (!data)
        return null
      return {
        ...f,
        name: f.family,
        cacheKey: `${f.family}-${f.weight}-${f.style}`,
        data,
      } satisfies SatoriFontConfig
    }),
  )
  return results.filter((f): f is SatoriFontConfig => f !== null)
}
