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
 * Extract CSS variables from universal selector blocks (*, ::before, ::after, etc.).
 * TW4 puts default shadow/ring/inset variables here as base-layer defaults.
 */
export function extractUniversalVars(css: string): Map<string, string> {
  const vars = new Map<string, string>()
  // Match blocks starting with `*` (e.g., `*, ::after, ::before { ... }`)
  const universalRe = /\*[^{]*\{([^}]+)\}/g
  for (const match of css.matchAll(universalRe)) {
    const body = match[1]!
    const declRe = /(--[\w-]+)\s*:\s*([^\s;][^;]*);/g
    for (const m of body.matchAll(declRe)) {
      if (m[1] && m[2])
        vars.set(m[1], m[2].trim())
    }
  }
  return vars
}

/**
 * Extract initial-value from @property rules.
 * CSS Houdini @property provides registered custom property defaults.
 * Used by UnoCSS preset-wind4 for shadow/ring variable defaults.
 */
export function extractPropertyInitialValues(css: string): Map<string, string> {
  const vars = new Map<string, string>()
  const propertyRe = /@property\s+(--[\w-]+)\s*\{([^}]+)\}/g
  for (const match of css.matchAll(propertyRe)) {
    const name = match[1]!
    const body = match[2]!
    const initialMatch = body.match(/initial-value\s*:\s*([^\s;][^;]*);?/)
    if (initialMatch?.[1])
      vars.set(name, initialMatch[1].trim())
  }
  return vars
}

/**
 * Extract per-class CSS variable declarations.
 * Returns a map of className -> { varName -> value } for classes that define CSS variables.
 * Used to capture TW4 class-scoped overrides (e.g., `.shadow-2xl { --tw-shadow: ... }`).
 */
export function extractPerClassVars(css: string): Map<string, Map<string, string>> {
  const result = new Map<string, Map<string, string>>()
  const ruleRe = /\.((?:\\[0-9a-f]{1,6}\s?|\\[^0-9a-f]|[^\\\s{])+)\s*\{([^}]+)\}/gi

  for (const match of css.matchAll(ruleRe)) {
    const rawSelector = match[1]!
    if (!isSimpleClassSelector(rawSelector))
      continue
    const className = decodeCssClassName(rawSelector)
    const body = match[2]!
    const classVars = new Map<string, string>()
    const declRe = /(--[\w-]+)\s*:\s*([^\s;][^;]*);/g
    for (const m of body.matchAll(declRe)) {
      if (m[1] && m[2])
        classVars.set(m[1], m[2].trim())
    }
    if (classVars.size > 0)
      result.set(className, classVars)
  }
  return result
}

/**
 * Resolve all var() references in a CSS string.
 * Handles nested var() fallbacks like var(--a, var(--b, initial)) by
 * resolving innermost var() calls first (inside-out).
 */
export function resolveCssVars(css: string, vars: Map<string, string>): string {
  let result = css
  let iterations = 0
  while (result.includes('var(') && iterations < 20) {
    const next = resolveInnermostVar(result, vars)
    if (next === result)
      break // no progress
    result = next
    iterations++
  }
  return result
}

/**
 * Find and resolve the innermost (last/deepest) var() call.
 * By resolving the last `var(` first, nested fallbacks like
 * `var(--a, var(--b, initial))` resolve inside-out.
 * Counts parenthesis depth to handle calc() etc. inside fallbacks.
 */
function resolveInnermostVar(css: string, vars: Map<string, string>): string {
  const idx = css.lastIndexOf('var(')
  if (idx === -1)
    return css
  // Walk forward from after `var(` counting paren depth to find matching `)`
  let depth = 1
  let close = -1
  for (let i = idx + 4; i < css.length; i++) {
    if (css[i] === '(') {
      depth++
    }
    else if (css[i] === ')') {
      depth--
      if (depth === 0) {
        close = i - idx - 4
        break
      }
    }
  }
  if (close === -1)
    return css
  const after = css.substring(idx + 4)
  const content = after.substring(0, close)
  // Only resolve if content has no nested var() — otherwise not truly innermost
  if (content.includes('var('))
    return css
  const comma = content.indexOf(',')
  let name: string
  let fallback: string | undefined
  if (comma >= 0) {
    name = content.substring(0, comma).trim()
    fallback = content.substring(comma + 1).trim()
  }
  else {
    name = content.trim()
  }
  const resolved = vars.get(name) ?? fallback ?? ''
  return css.substring(0, idx) + resolved + css.substring(idx + 4 + close + 1)
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
  /** Collect CSS variables (--*) per class into this map instead of skipping them */
  collectVars?: Map<string, string>
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
  const { camelCase = false, normalize = false, skipPrefixes = ['--'], merge = false, collectVars } = options
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

      // Collect CSS variables into separate map if requested
      if (prop.startsWith('--')) {
        if (collectVars)
          collectVars.set(prop, value)
        if (skipPrefixes.some(p => prop.startsWith(p)))
          continue
      }
      else if (skipPrefixes.some(p => prop.startsWith(p))) {
        continue
      }

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
  // Strip !important before parsing
  const cleaned = cssValue.replace(/\s*!important\s*$/, '')
  const families: string[] = []
  for (const part of cleaned.split(',')) {
    const name = part.trim().replace(/^['"]|['"]$/g, '')
    if (name && !GENERIC_FONT_FAMILIES.has(name.toLowerCase()))
      families.push(name)
  }
  return families
}

// ============================================================================
// Satori compatibility transforms
// ============================================================================

/**
 * Convert CSS individual transform properties (rotate, scale, translate)
 * to the shorthand `transform` property for Satori compatibility.
 * Mutates the styles object in place.
 */
export function convertIndividualTransforms(styles: Record<string, string>): void {
  const parts: string[] = []

  if (styles.translate) {
    // CSS `translate: x y` → `translate(x, y)` or `translateX(x)`
    const vals = styles.translate.trim().split(/\s+/)
    if (vals.length === 2)
      parts.push(`translate(${vals[0]}, ${vals[1]})`)
    else if (vals.length === 1 && vals[0])
      parts.push(`translateX(${vals[0]})`)
    delete styles.translate
  }
  if (styles.rotate) {
    parts.push(`rotate(${styles.rotate})`)
    delete styles.rotate
  }
  if (styles.scale) {
    const vals = styles.scale.trim().split(/\s+/).filter(Boolean)
    if (vals.length >= 1)
      parts.push(`scale(${vals.join(', ')})`)
    delete styles.scale
  }

  if (parts.length > 0) {
    // Prepend to existing transform if present
    const existing = styles.transform
    styles.transform = existing ? `${parts.join(' ')} ${existing}` : parts.join(' ')
  }
}

/**
 * Expand CSS logical properties to physical longhands for Satori compatibility.
 * Satori doesn't support `inset`, `inset-inline`, `inset-block`,
 * `padding-inline`, `padding-block`, `margin-inline`, or `margin-block`.
 * Mutates the styles object in place.
 */
export function convertLogicalProperties(styles: Record<string, string>): void {
  if (styles.inset) {
    const v = styles.inset
    styles.top ??= v
    styles.right ??= v
    styles.bottom ??= v
    styles.left ??= v
    delete styles.inset
  }
  // inset-inline (TW4 output for inset-x-*)
  const inlineVal = styles['inset-inline']
  if (inlineVal) {
    styles.left ??= inlineVal
    styles.right ??= inlineVal
    delete styles['inset-inline']
  }
  // inset-block (TW4 output for inset-y-*)
  const blockVal = styles['inset-block']
  if (blockVal) {
    styles.top ??= blockVal
    styles.bottom ??= blockVal
    delete styles['inset-block']
  }
  // Expand logical box properties to physical longhands (kebab-case only)
  const logicalProps = [
    ['padding-inline', 'padding-left', 'padding-right'],
    ['padding-block', 'padding-top', 'padding-bottom'],
    ['margin-inline', 'margin-left', 'margin-right'],
    ['margin-block', 'margin-top', 'margin-bottom'],
  ] as const
  for (const [logical, physA, physB] of logicalProps) {
    if (styles[logical]) {
      const v = styles[logical]
      styles[physA] ??= v
      styles[physB] ??= v
      delete styles[logical]
    }
  }
}

// ============================================================================
// Calc evaluation
// ============================================================================

/**
 * Evaluate calc() expressions using Lightning CSS.
 */
export async function evaluateCalc(value: string): Promise<string> {
  if (!value.includes('calc('))
    return value
  const fakeCss = `.x{v:${value}}`
  const result = await simplifyCss(fakeCss)
  // Safe: value ends with [^\s;] to prevent overlap with trailing \s*
  const match = result.match(/\.x\s*\{\s*v:\s*([^\s;](?:[^;]*[^\s;])?);?\s*\}/)
  return match?.[1]?.trim() ?? value
}

// ============================================================================
// Deep var resolution
// ============================================================================

/**
 * Resolve var() references recursively with calc() evaluation.
 * Handles calc(var(--name) * N) optimization and nested var() references.
 */
export async function resolveVarsDeep(value: string, vars: Map<string, string>, depth = 0): Promise<string> {
  if (depth > 10 || !value.includes('var('))
    return evaluateCalc(value)

  // Optimize: calc(var(--name) * N) → pre-computed value
  const calcMatch = value.match(/calc\(var\((--[\w-]+)\)\s*\*\s*([\d.]+)\)/)
  if (calcMatch?.[1] && calcMatch?.[2]) {
    const varValue = vars.get(calcMatch[1])
    if (varValue) {
      const numMatch = varValue.match(/([\d.]+)(rem|px|em|%)/)
      if (numMatch?.[1] && numMatch?.[2]) {
        const computed = Number.parseFloat(numMatch[1]) * Number.parseFloat(calcMatch[2])
        return `${computed}${numMatch[2]}`
      }
    }
  }

  const result = resolveCssVars(value, vars)

  if (result.includes('var(') && depth < 10)
    return resolveVarsDeep(result, vars, depth + 1)

  return evaluateCalc(result)
}

// ============================================================================
// Post-processing pipeline
// ============================================================================

/**
 * Shared post-processing pipeline for resolved CSS styles.
 * Handles: resolve vars → skip unresolvable → convert colors → normalize opacity →
 * convertIndividualTransforms → convertLogicalProperties.
 * Returns null if no styles survive processing.
 */
export async function postProcessStyles(
  rawStyles: Record<string, string>,
  vars: Map<string, string>,
  resolveVar?: (value: string, vars: Map<string, string>) => Promise<string> | string,
): Promise<Record<string, string> | null> {
  const styles: Record<string, string> = {}
  const resolve = resolveVar || resolveVarsDeep

  for (const [prop, rawValue] of Object.entries(rawStyles)) {
    let value = await resolve(rawValue, vars)

    // Skip unresolvable var() references
    if (value.includes('var('))
      continue

    // Skip CSS global keywords — Satori doesn't understand them
    if (value === 'initial' || value === 'inherit' || value === 'unset' || value === 'revert')
      continue

    // Skip malformed calc() from unresolved vars (e.g., "calc( * 16)")
    if (/calc\(\s*[*/]/.test(value))
      continue

    // Normalize calc(infinity * 1px) → 9999px (TW4 rounded-full, etc.)
    // Also catch Lightning CSS pre-evaluated infinity: 3.40282e38px
    if (value.includes('calc(infinity') || /\d\.?\d*e\+?\d+px/.test(value))
      value = '9999px'

    // Clean up empty segments in comma-separated values
    // (e.g., ", , , 0 10px 15px" → "0 10px 15px" from unresolved shadow vars)
    if (value.includes(',')) {
      const cleaned = value.split(',').map(s => s.trim()).filter(Boolean).join(', ')
      if (!cleaned)
        continue
      value = cleaned
    }

    // Convert colors
    if (COLOR_PROPERTIES.has(prop)) {
      if (prop === 'background-image' && value.includes('gradient')) {
        value = value.replace(/oklch\([^)]+\)/g, (match) => {
          const hex = convertColorToHex(match)
          return hex.startsWith('#') ? hex : match
        })
      }
      else {
        // Handle color-mix(in oklab, <color> N%, transparent) → <color>
        if (value.startsWith('color-mix(')) {
          const mixMatch = value.match(/color-mix\(in\s+\w+,\s*([#\w().,\s]+?)\s+(\d+)%,\s*transparent\)/)
          if (mixMatch?.[1] && mixMatch?.[2] === '100')
            value = mixMatch[1].trim()
        }
        value = convertColorToHex(value)
      }
    }

    // Normalize opacity percentage to decimal
    if (prop === 'opacity' && value.endsWith('%'))
      value = String(Number.parseFloat(value) / 100)

    styles[prop] = value
  }

  // Satori compat transforms
  convertIndividualTransforms(styles)
  convertLogicalProperties(styles)

  return Object.keys(styles).length ? styles : null
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
