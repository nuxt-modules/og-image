import { withBase } from 'ufo'

export interface FontPreviewFace {
  family: string
  weight: number
  style: string
  src: string
  subset?: string
  unicodeRange?: string
  weightRange?: [number, number]
  size?: number
}

export function getFontPreviewFaces(available: FontPreviewFace[], resolved: FontPreviewFace[]): FontPreviewFace[] {
  const seen = new Set<string>()
  return [...available, ...resolved].filter((face) => {
    const key = JSON.stringify([face.family, face.weight, face.style, face.src, face.unicodeRange])
    if (seen.has(key))
      return false
    seen.add(key)
    return true
  })
}

export function createFontPreviewCss(faces: FontPreviewFace[], origin: string): string {
  const seen = new Set<string>()
  const appUrl = origin ? new URL(origin) : undefined
  return faces.flatMap((face) => {
    const weight = face.weightRange?.join(' ') || String(face.weight)
    const key = JSON.stringify([face.family, weight, face.style, face.src, face.unicodeRange])
    if (seen.has(key))
      return []
    seen.add(key)
    const path = appUrl && face.src.startsWith('/_og-static-fonts/') ? withBase(face.src, appUrl.pathname) : face.src
    const src = appUrl ? new URL(path, appUrl).href : path
    return [`@font-face { font-family: ${JSON.stringify(`ogp-${face.family}`)}; src: url(${JSON.stringify(src)}); font-weight: ${weight}; font-style: ${face.style};${face.unicodeRange ? ` unicode-range: ${face.unicodeRange};` : ''} font-display: swap; }`]
  }).join('\n')
}
