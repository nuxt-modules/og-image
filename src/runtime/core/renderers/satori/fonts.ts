import type { FontConfig, OgImageRenderEventContext } from '../../../types'
import { loadFont } from '../../font/fetch'

export const satoriFonts: any[] = []
let fontLoadPromise: Promise<any> | null = null
export function loadFonts(e: OgImageRenderEventContext, fonts: FontConfig[]) {
  if (fontLoadPromise)
    return fontLoadPromise

  return (fontLoadPromise = Promise.all(fonts.map(font => loadFont(e, font))))
}
