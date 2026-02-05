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
    // eslint-disable-next-line regexp/no-super-linear-backtracking
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
    // eslint-disable-next-line regexp/no-super-linear-backtracking
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
 */
export function extractClassStyles(
  css: string,
  options: ExtractClassStylesOptions = {},
): Map<string, Record<string, string>> {
  const { camelCase = false, normalize = false, skipPrefixes = ['--'], merge = false } = options
  const classes = new Map<string, Record<string, string>>()

  // Match .selector { body } - no ^ anchor as rules may be inside @layer blocks
  // eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/no-dupe-disjunctions
  const ruleRe = /\.((?:\\[0-9a-f]+\s?|\\.|[^\s{])+)\s*\{([^}]+)\}/gi

  for (const match of css.matchAll(ruleRe)) {
    const rawSelector = match[1]!
    const body = match[2]!

    if (!isSimpleClassSelector(rawSelector))
      continue

    const className = decodeCssClassName(rawSelector)
    const styles: Record<string, string> = merge ? (classes.get(className) || {}) : {}

    // eslint-disable-next-line regexp/no-super-linear-backtracking
    const declRe = /([\w-]+)\s*:\s*([^;]+);/g
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
