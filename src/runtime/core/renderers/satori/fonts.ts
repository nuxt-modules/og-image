import type { FontConfig, H3EventOgImageRender } from '../../../types'
import { loadFont } from '../../font/fetch'

export const satoriFonts: any[] = []
let fontLoadPromise: Promise<any> | null = null
export function loadFonts(e: H3EventOgImageRender, fonts: FontConfig[]) {
  if (fontLoadPromise)
    return fontLoadPromise

  return (fontLoadPromise = Promise.all(fonts.map(font => loadFont(e, font))))
}
