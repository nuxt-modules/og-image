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
 */
export function extractCssVars(css: string): Map<string, string> {
  const vars = new Map<string, string>()
  const rootRe = /:(?:root|host)\s*\{([^}]+)\}/g
  for (const match of css.matchAll(rootRe)) {
    const body = match[1]!
    const declRe = /(--[\w-]+)\s*:\s*([^;]+);/g
    for (const m of body.matchAll(declRe)) {
      if (m[1] && m[2])
        vars.set(m[1], m[2].trim())
    }
  }
  return vars
}

/**
 * Resolve all var() references in a CSS string.
 */
export function resolveCssVars(css: string, vars: Map<string, string>): string {
  let result = css
  let iterations = 0
  while (result.includes('var(') && iterations < 20) {
    result = result.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_, name, fallback) => {
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
  // Hex escapes: \32 -> '2' (with optional trailing space)
  className = className.replace(/\\([0-9a-f]+)\s?/gi, (_, hex) =>
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
  const withoutEscapes = selector.replace(/\\[0-9a-f]+\s?/gi, '_').replace(/\\./g, '_')

  // Check for combinators (real spaces, >, +, ~)
  if (/[\s>+~]/.test(withoutEscapes))
    return false

  // Check for unescaped pseudo-class (: followed by alpha)
  if (/:[a-z]/i.test(withoutEscapes))
    return false

  return true
}

/**
 * Extract class rules from CSS into a map of className -> styles.
 * Only extracts simple class selectors (no pseudo-classes, combinators).
 */
export function extractClassStyles(css: string): Map<string, Record<string, string>> {
  const classes = new Map<string, Record<string, string>>()

  // Match .selector { body }
  // Selector can contain escapes like \32 (with trailing space)
  const ruleRe = /^\.((?:\\[0-9a-f]+\s?|\\.|[^\s{])+)\s*\{([^}]+)\}/gim

  for (const match of css.matchAll(ruleRe)) {
    const rawSelector = match[1]!
    const body = match[2]!

    if (!isSimpleClassSelector(rawSelector))
      continue

    const className = decodeCssClassName(rawSelector)

    const styles: Record<string, string> = {}
    const declRe = /([\w-]+)\s*:\s*([^;]+);/g
    for (const declMatch of body.matchAll(declRe)) {
      const prop = declMatch[1]!
      const value = declMatch[2]!.trim()
      // Skip CSS variables
      if (prop.startsWith('--'))
        continue
      styles[prop] = value
    }

    if (Object.keys(styles).length)
      classes.set(className, styles)
  }

  return classes
}

/**
 * Full CSS processing pipeline:
 * 1. Extract vars from :root/:host
 * 2. Resolve var() references
 * 3. Simplify calc() with Lightning CSS
 * 4. Extract class styles
 */
export async function processCss(css: string, additionalVars?: Map<string, string>): Promise<{
  vars: Map<string, string>
  classes: Map<string, Record<string, string>>
}> {
  // Step 1: Extract variables
  const vars = extractCssVars(css)

  // Merge additional vars (e.g., from Nuxt UI)
  if (additionalVars) {
    for (const [name, value] of additionalVars) {
      if (!vars.has(name))
        vars.set(name, value)
    }
  }

  // Step 2: Resolve var() references
  const resolvedCss = resolveCssVars(css, vars)

  // Step 3: Simplify with Lightning CSS
  const simplifiedCss = await simplifyCss(resolvedCss)

  // Step 4: Extract class styles
  const classes = extractClassStyles(simplifiedCss)

  return { vars, classes }
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
 * Convert oklch colors in a CSS string to hex.
 */
export function convertOklchToHex(css: string): string {
  return css.replace(/oklch\([^)]+\)/g, match => convertColorToHex(match))
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

// ============================================================================
// Legacy exports (for gradual migration)
// ============================================================================

/**
 * @deprecated Use loadLightningCss instead
 */
export async function loadPostcss() {
  // Return shim that provides similar interface for gradual migration
  const { transform } = await loadLightningCss()
  return {
    postcss: {
      parse: (css: string) => {
        throw new Error('postcss.parse() is deprecated. Use extractClassStyles() or processCss() instead.')
      },
    },
    postcssCalc: () => {
      throw new Error('postcssCalc is deprecated. Use simplifyCss() instead.')
    },
  }
}
