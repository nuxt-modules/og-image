import type { H3Event } from 'h3'
import type { FontConfig, SatoriFontConfig } from '../../types'
import { resolve } from '#og-image-virtual/public-assets.mjs'
import resolvedFonts from '#og-image/fonts'
import { fontCache } from './cache/lru'

export interface LoadFontsOptions {
  supportsWoff2: boolean
}

async function loadFont(event: H3Event, font: FontConfig): Promise<BufferSource> {
  const cacheKey = `${font.family}-${font.weight}-${font.style}`
  const cached = await fontCache.getItem(cacheKey)
  if (cached)
    return cached
  const data = await resolve(event, font)
  await fontCache.setItem(cacheKey, data)
  return data
}

export async function loadAllFonts(event: H3Event, options: LoadFontsOptions): Promise<SatoriFontConfig[]> {
  const fonts = (resolvedFonts as FontConfig[]).filter((f) => {
    if (options.supportsWoff2)
      return true
    return !f.src.endsWith('.woff2')
  })

  return Promise.all(
    fonts.map(async f => ({
      ...f,
      name: f.family,
      cacheKey: `${f.family}-${f.weight}-${f.style}`,
      data: await loadFont(event, f),
    } satisfies SatoriFontConfig)),
  )
}
