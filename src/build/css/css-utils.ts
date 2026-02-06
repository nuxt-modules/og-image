import type { TemplateChildNode } from '@vue/compiler-core'
import { formatHex, parse, toGamut } from 'culori'

// Gamut map oklch to sRGB using culori's toGamut
const toSrgbGamut = toGamut('rgb', 'oklch')

// ============================================================================
// Lightning CSS lazy loading (replaces postcss)
// ============================================================================

let transform: typeof import('lightningcss').transform

export async function loadLightningCss() {
  if (!transform) {
    const lcss = await import('lightningcss')
    transform = lcss.transform
  }
  return { transform }
}

/**
 * Simplify CSS using Lightning CSS.
 * - Evaluates calc() expressions where possible
 * - Normalizes values
 */
export async function simplifyCss(css: string): Promise<string> {
  const { transform } = await loadLightningCss()
  const result = transform({
    filename: 'input.css',
    code: Buffer.from(css),
    minify: false,
  })
  return result.code.toString()
}

/**
 * Extract CSS variables from :root/:host blocks.
 * Uses safe regex patterns that avoid exponential backtracking.
 */
export function extractCssVars(css: string): Map<string, string> {
  const vars = new Map<string, string>()
  // Safe: [^}]+ cannot backtrack dangerously
  const rootRe = /:(?:root|host)\s*\{([^}]+)\}/g
  for (const match of css.matchAll(rootRe)) {
    const body = match[1]!
    // Safe: value starts with non-whitespace [^\s;] then any [^;]*
    // This prevents \s* from exchanging characters with value
    const declRe = /(--[\w-]+)\s*:\s*([^\s;][^;]*);/g
    for (const m of body.matchAll(declRe)) {
      if (m[1] && m[2])
        vars.set(m[1], m[2].trim())
    }
  }
  return vars
}

/**
 * Resolve all var() references in a CSS string.
 * Uses safe regex without nested quantifiers.
 */
export function resolveCssVars(css: string, vars: Map<string, string>): string {
  let result = css
  let iterations = 0
  while (result.includes('var(') && iterations < 20) {
    // Safe: var name is [\w-]+ (no nesting)
    // Fallback starts with non-whitespace [^\s)] to prevent overlap with \s*
    result = result.replace(/var\((--[\w-]+)(?:,\s*([^\s)][^)]*))?\)/g, (_, name, fallback) => {
      return vars.get(name) ?? fallback ?? ''
    })
    iterations++
  }
  return result
}

/**
 * Decode CSS selector escape sequences to get the actual class name.
 * Handles: .\32xl -> 2xl (hex escapes), .m-0\.5 -> m-0.5 (escaped chars)
 */
export function decodeCssClassName(selector: string): string {
  let className = selector.startsWith('.') ? selector.slice(1) : selector
  // Hex escapes: \32 -> '2' (CSS allows 1-6 hex digits + optional space)
  // Safe: {1,6} limits repetition, no nested quantifiers
  className = className.replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex) =>
    String.fromCodePoint(Number.parseInt(hex, 16)))
  // Escaped special chars: \. -> .
  className = className.replace(/\\(.)/g, '$1')
  return className
}

/**
 * Check if selector is a simple class (no pseudo-classes, combinators).
 * Must handle CSS escapes like `\32 xl` where space is part of escape.
 */
export function isSimpleClassSelector(selector: string): boolean {
  // Remove escape sequences to check for real spaces/combinators
  // Safe: {1,6} limits hex digit repetition
  const withoutEscapes = selector.replace(/\\[0-9a-f]{1,6}\s?/gi, '_').replace(/\\./g, '_')

  // Check for combinators (real spaces, >, +, ~)
  if (/[\s>+~]/.test(withoutEscapes))
    return false

  // Check for unescaped pseudo-class (: followed by alpha)
  if (/:[a-z]/i.test(withoutEscapes))
    return false

  return true
}

export interface ExtractClassStylesOptions {
  /** Convert property names to camelCase (default: false) */
  camelCase?: boolean
  /** Normalize TW4 values: infinity calc → 9999px, opacity % → decimal (default: false) */
  normalize?: boolean
  /** Skip properties starting with these prefixes (default: ['--']) */
  skipPrefixes?: string[]
  /** Merge styles for duplicate class selectors (default: false, overwrites) */
  merge?: boolean
}

/**
 * Extract class rules from CSS into a map of className -> styles.
 * Only extracts simple class selectors (no pseudo-classes, combinators).
 * Uses safe regex patterns to avoid exponential backtracking.
 */
export function extractClassStyles(
  css: string,
  options: ExtractClassStylesOptions = {},
): Map<string, Record<string, string>> {
  const { camelCase = false, normalize = false, skipPrefixes = ['--'], merge = false } = options
  const classes = new Map<string, Record<string, string>>()

  // Match .selector { body }
  // Safe regex: hex escapes limited to 1-6 digits (CSS spec)
  // [^\\\s{] excludes backslash to prevent overlap with escape sequences
  // \\[^0-9a-f] handles non-hex escapes without overlapping hex escapes
  const ruleRe = /\.((?:\\[0-9a-f]{1,6}\s?|\\[^0-9a-f]|[^\\\s{])+)\s*\{([^}]+)\}/gi

  for (const match of css.matchAll(ruleRe)) {
    const rawSelector = match[1]!
    const body = match[2]!

    if (!isSimpleClassSelector(rawSelector))
      continue

    const className = decodeCssClassName(rawSelector)
    const styles: Record<string, string> = merge ? (classes.get(className) || {}) : {}

    // Safe: value starts with non-whitespace [^\s;] to prevent overlap with \s*
    const declRe = /([\w-]+)\s*:\s*([^\s;][^;]*);/g
    for (const declMatch of body.matchAll(declRe)) {
      const prop = declMatch[1]!
      let value = declMatch[2]!.trim()

      // Skip properties with specified prefixes
      if (skipPrefixes.some(p => prop.startsWith(p)))
        continue

      // Normalize TW4-specific values
      if (normalize) {
        if (value.includes('calc(infinity'))
          value = '9999px'
        if (prop === 'opacity' && value.endsWith('%'))
          value = String(Number.parseFloat(value) / 100)
      }

      const finalProp = camelCase ? prop.replace(/-([a-z])/g, (_, l) => l.toUpperCase()) : prop
      styles[finalProp] = value
    }

    if (Object.keys(styles).length)
      classes.set(className, styles)
  }

  return classes
}

// ============================================================================
// Color utilities
// ============================================================================

/**
 * Convert any CSS color to hex with proper gamut mapping for oklch.
 * Returns original value if parsing fails or contains var().
 */
export function convertColorToHex(value: string): string {
  if (!value || value.includes('var('))
    return value
  const color = parse(value)
  if (!color)
    return value
  const mapped = toSrgbGamut(color)
  return formatHex(mapped) || value
}

/**
 * CSS properties that contain colors (need oklch→hex conversion)
 */
export const COLOR_PROPERTIES = new Set([
  'color',
  'background-color',
  'background-image',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'fill',
  'stroke',
  'text-decoration-color',
  'caret-color',
  'accent-color',
])

// ============================================================================
// Font-face parsing utilities
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

/**
 * Extract @font-face rules from CSS using LightningCSS parser.
 * Returns structured font descriptors with proper handling of:
 * - Multiple src values (url + local fallbacks)
 * - Weight ranges for variable fonts
 * - Unicode ranges
 * - Format hints
 */
export async function extractFontFaces(css: string): Promise<FontFaceDescriptor[]> {
  const { transform } = await loadLightningCss()
  const fonts: FontFaceDescriptor[] = []

  transform({
    filename: 'fonts.css',
    code: Buffer.from(css),
    minify: false,
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
                // FontFamily is either string or array of family names
                const val = prop.value
                family = Array.isArray(val) ? val[0] : val
                break
              }
              case 'font-weight': {
                // Size2DFor_FontWeight is [FontWeight, FontWeight]
                // FontWeight is { type: 'absolute', value: AbsoluteFontWeight } | 'bolder' | 'lighter'
                // AbsoluteFontWeight is { type: 'weight', value: number } | 'normal' | 'bold'
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
                  return 400 // bolder/lighter fallback
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
                // Convert UnicodeRange[] to CSS string format
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
 * More convenient for cases where you just need family/url/weight/style.
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
    // For weight ranges, use 400 if in range, otherwise min
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
  }).filter(f => f.src) // Filter out fonts without url sources
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
  // Match subset comment + @font-face block pairs, and standalone @font-face blocks
  // Subset comment format: /* latin */ or /* cyrillic-ext */
  const fontFaceRe = /(?:\/\*\s*([a-z-]+)\s*\*\/\s*)?(@font-face\s*\{[^}]+\})/g
  const chunks: Array<{ subset?: string, css: string }> = []

  for (const match of css.matchAll(fontFaceRe)) {
    const subset = match[1] // undefined if no subset comment
    const fontFaceCss = match[2]!
    chunks.push({ subset, css: fontFaceCss })
  }

  // Parse each chunk and filter by allowed subsets
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
    // Filter: include if no subset (non-Google fonts) or subset is allowed
    if (chunk.subset && !allowedSubsets.includes(chunk.subset))
      continue

    const fonts = await extractFontFacesSimple(chunk.css)
    for (const font of fonts) {
      results.push({ ...font, subset: chunk.subset })
    }
  }

  return results
}

// ============================================================================
// Font family utilities
// ============================================================================

/** Generic font families that don't map to loaded fonts */
export const GENERIC_FONT_FAMILIES = new Set([
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
  'inherit',
  'initial',
  'unset',
])

/** Extract custom (non-generic) font family names from a CSS font-family value */
export function extractCustomFontFamilies(cssValue: string): string[] {
  const families: string[] = []
  for (const part of cssValue.split(',')) {
    const name = part.trim().replace(/^['"]|['"]$/g, '')
    if (name && !GENERIC_FONT_FAMILIES.has(name.toLowerCase()))
      families.push(name)
  }
  return families
}

// ============================================================================
// Template utilities
// ============================================================================

/**
 * Walk Vue template AST nodes recursively.
 */
export function walkTemplateAst(
  nodes: TemplateChildNode[],
  visitor: (node: TemplateChildNode) => void,
): void {
  for (const node of nodes) {
    visitor(node)
    if ('children' in node && Array.isArray(node.children))
      walkTemplateAst(node.children as TemplateChildNode[], visitor)
  }
}
