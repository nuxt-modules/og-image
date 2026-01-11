import type { ResolvedFontConfig } from '../../types'
import { $fetch } from 'ofetch'

interface ResolvedNuxtFont {
  family: string
  weight: number
  style: 'normal' | 'italic'
  src: string // original provider URL for fallback
  localPath: string // /_fonts/{filename}
}

export async function tryResolveNuxtFont(font: ResolvedFontConfig): Promise<ResolvedFontConfig | null> {
  const fontsModule = await import('#nuxt-og-image/fonts').catch(() => null)
  if (!fontsModule?.hasNuxtFonts)
    return null

  const { resolvedFonts } = fontsModule as { resolvedFonts: ResolvedNuxtFont[] }
  if (!resolvedFonts?.length)
    return null

  const targetWeight = font.weight || 400
  const targetStyle = font.style || 'normal'

  const match = resolvedFonts.find(f =>
    f.family === font.name
    && f.weight === targetWeight
    && f.style === targetStyle,
  )

  if (!match)
    return null

  const cacheKey = `${match.family}-${match.weight}-${match.style}`

  // fetch from /_fonts/ - @nuxt/fonts serves and caches this
  const response = await $fetch(match.localPath, {
    responseType: 'arrayBuffer',
  }).catch(() => null)

  if (response) {
    return {
      ...font,
      data: Buffer.from(response),
      cacheKey,
    }
  }

  // fallback to original provider URL
  const fallbackResponse = await $fetch(match.src, {
    responseType: 'arrayBuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Nuxt OG Image)',
    },
  }).catch(() => null)

  if (!fallbackResponse)
    return null

  return {
    ...font,
    data: Buffer.from(fallbackResponse),
    cacheKey,
  }
}
