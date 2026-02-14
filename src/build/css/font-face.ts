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
}>> {
  const fonts = await extractFontFaces(css)
  return fonts.map((font) => {
    const urlSource = font.sources.find(s => s.type === 'url')
    let weight: number
    if (Array.isArray(font.weight)) {
      const [min, max] = font.weight
      weight = (min <= 400 && max >= 400) ? 400 : min
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
    }
  }).filter(f => f.src)
}

/**
 * Extract @font-face rules with Google Fonts subset comments (e.g. latin, cyrillic-ext).
 * Filters by allowed subsets; fonts without subset comments are always included.
 */
export async function extractFontFacesWithSubsets(
  css: string,
  allowedSubsets: string[] = ['latin'],
): Promise<Array<{
  family: string
  src: string
  weight: number
  style: string
  unicodeRange?: string
  isWoff2: boolean
  subset?: string
}>> {
  const fontFaceRe = /(?:\/\*\s*([a-z-]+)\s*\*\/\s*)?(@font-face\s*\{[^}]+\})/g
  const chunks: Array<{ subset?: string, css: string }> = []

  for (const match of css.matchAll(fontFaceRe)) {
    const subset = match[1]
    const fontFaceCss = match[2]!
    chunks.push({ subset, css: fontFaceCss })
  }

  const results: Array<{
    family: string
    src: string
    weight: number
    style: string
    unicodeRange?: string
    isWoff2: boolean
    subset?: string
  }> = []

  for (const chunk of chunks) {
    if (chunk.subset && !allowedSubsets.includes(chunk.subset))
      continue

    const fonts = await extractFontFacesSimple(chunk.css)
    for (const font of fonts) {
      results.push({ ...font, subset: chunk.subset })
    }
  }

  return results
}
