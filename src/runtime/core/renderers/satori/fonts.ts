import type { FontConfig } from '../../../types'
import { loadFont } from '../../font/fetch'

export const satoriFonts: any[] = []
let fontLoadPromise: Promise<any> | null = null
export function loadFonts(baseURL: string, fonts: FontConfig[]) {
  if (fontLoadPromise)
    return fontLoadPromise

  return (fontLoadPromise = Promise.all(fonts.map(font => loadFont(baseURL, font))))
}
