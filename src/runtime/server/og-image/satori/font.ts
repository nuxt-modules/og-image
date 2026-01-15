import type { OgImageRenderEventContext, ResolvedFontConfig } from '../../../types'
import { resolve } from '#og-image-virtual/public-assets.mjs'

export async function loadFont(_: OgImageRenderEventContext, font: ResolvedFontConfig): Promise<ResolvedFontConfig> {
  if (font.data || !font.key)
    return font
  const fontData: string | Uint8Array | null = await resolve(font.key)
  if (!fontData) {
    throw new Error(`Font with key "${font.key}" not found in assets.`)
  }
  // if buffer
  // fontData is a base64 string, need to turn it into a buffer
  font.data = Buffer.from(String(fontData), 'base64')
  return font
}
