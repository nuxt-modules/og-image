import type { OgImageRenderEventContext } from '../../../types'
import { tryResolveNuxtFont } from '../../utils/nuxt-fonts'

export async function loadFont(ctx: OgImageRenderEventContext, font: any): Promise<any> {
  if (font.data)
    return font

  // Use Nuxt Fonts integration
  const nuxtFont = await tryResolveNuxtFont(font)
  if (nuxtFont?.data) {
    return nuxtFont
  }

  // If Nuxt Fonts doesn't have the font, throw an error
  throw new Error(`Font '${font.name}' with weight ${font.weight} not found. Please ensure it's configured in @nuxt/fonts.`)
}
