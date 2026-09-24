import { loadLightningCss } from './css-utils'

// ============================================================================
// Types
// ============================================================================

export interface FontFaceDescriptor {
  /** Font family name */
  family: string
  /** Font sources with url and optional format */
  sources: Array<{
    type: 'url' | 'local'
    url?: string
    name?: string
    format?: string
  }>
  /** Font weight - single value or [min, max] range for variable fonts */
  weight: number | [number, number]
  /** Font style: normal, italic, or oblique */
  style: 'normal' | 'italic' | 'oblique'
  /** Unicode ranges this font covers */
  unicodeRange?: string
}

// ============================================================================
// Parsing
// ============================================================================

/**
 * Extract @font-face rules from CSS using LightningCSS parser.
 */
export async function extractFontFaces(css: string): Promise<FontFaceDescriptor[]> {
  const { transform } = await loadLightningCss()
  const fonts: FontFaceDescriptor[] = []

  transform({
    filename: 'fonts.css',
    code: Buffer.from(css),
    minify: false,
    errorRecovery: true,
    visitor: {
      Rule: {
        'font-face': (rule) => {
          let family: string | undefined
          let weight: number | [number, number] = 400
          let style: 'normal' | 'italic' | 'oblique' = 'normal'
          let unicodeRange: string | undefined
          const sources: FontFaceDescriptor['sources'] = []

          for (const prop of rule.value.properties) {
            switch (prop.type) {
              case 'font-family': {
                const val = prop.value
                family = Array.isArray(val) ? val[0] : val
                break
              }
              case 'font-weight': {
                const [min, max] = prop.value
                const getWeight = (fw: typeof min): number => {
                  if (fw.type === 'absolute') {
                    const abs = fw.value
                    if (abs.type === 'weight')
                      return abs.value
                    if (abs.type === 'normal')
                      return 400
                    if (abs.type === 'bold')
                      return 700
                  }
                  return 400
                }
                const minVal = getWeight(min)
                const maxVal = getWeight(max)
                weight = minVal === maxVal ? minVal : [minVal, maxVal]
                break
              }
              case 'font-style': {
                style = prop.value.type as 'normal' | 'italic' | 'oblique'
                break
              }
              case 'unicode-range': {
                unicodeRange = prop.value
                  .map((r: { start: number, end: number }) =>
                    r.start === r.end
                      ? `U+${r.start.toString(16).toUpperCase()}`
                      : `U+${r.start.toString(16).toUpperCase()}-${r.end.toString(16).toUpperCase()}`)
                  .join(', ')
                break
              }
              case 'source': {
                for (const src of prop.value) {
                  if (src.type === 'url') {
                    sources.push({
                      type: 'url',
                      url: src.value.url.url,
                      format: src.value.format?.type,
                    })
                  }
                  else if (src.type === 'local') {
                    const name = Array.isArray(src.value) ? src.value[0] : src.value
                    sources.push({ type: 'local', name })
                  }
                }
                break
              }
            }
          }

          if (family && sources.length > 0) {
            fonts.push({ family, sources, weight, style, unicodeRange })
          }

          return rule
        },
      },
    },
  })

  return fonts
}

/**
 * Simplified font extraction that returns the first url source per font.
 */
export async function extractFontFacesSimple(css: string): Promise<Array<{
  family: string
  src: string
  weight: number
  style: string
  unicodeRange?: string
  isWoff2: boolean
  /** Original weight range for variable fonts (e.g. [100, 900]) */
  weightRange?: [number, number]
}>> {
  const fonts = await extractFontFaces(css)
  return fonts.map((font) => {
    const urlSource = font.sources.find(s => s.type === 'url')
    let weight: number
    let weightRange: [number, number] | undefined
    if (Array.isArray(font.weight)) {
      const [min, max] = font.weight
      weight = (min <= 400 && max >= 400) ? 400 : min
      weightRange = [min, max]
    }
    else {
      weight = font.weight
    }
    const src = urlSource?.url || ''
    return {
      family: font.family,
      src,
      weight,
      style: font.style,
      unicodeRange: font.unicodeRange,
      isWoff2: src.endsWith('.woff2'),
      weightRange,
    }
  }).filter(f => f.src)
}

/** A font face in the shape og-image builds its font list from. */
export interface NuxtFontFace {
  family: string
  src: string
  weight: number
  style: string
  unicodeRange?: string
  isWoff2: boolean
  subset?: string
  weightRange?: [number, number]
}

/** A `@font-face` rule as `@nuxt/fonts` passes it to the `fonts:resolved` hook. */
export interface ResolvedFontFace {
  src: Array<{ url: string, originalURL?: string, format?: string } | { name: string }>
  weight?: string | number | [number, number]
  style?: string
  unicodeRange?: string[]
  meta?: { subset?: string }
}

/** Read the faces `@nuxt/fonts` passes to the `fonts:resolved` hook. */
export function fontFacesFromResolved(family: string, faces: ResolvedFontFace[]): NuxtFontFace[] {
  return faces.flatMap((face) => {
    const source = face.src.find((s): s is { url: string } => 'url' in s)
    if (!source)
      return []
    const range = typeof face.weight === 'string'
      ? face.weight.split(/\s+/).map(Number)
      : Array.isArray(face.weight) ? face.weight : [face.weight ?? 400]
    const [min = 400, max = min] = range
    const weightRange: [number, number] | undefined = max !== min ? [min, max] : undefined
    return [{
      family,
      src: source.url,
      weight: weightRange ? (min <= 400 && max >= 400 ? 400 : min) : min,
      style: face.style || 'normal',
      unicodeRange: face.unicodeRange?.join(','),
      isWoff2: source.url.endsWith('.woff2'),
      subset: face.meta?.subset,
      weightRange,
    }]
  })
}
