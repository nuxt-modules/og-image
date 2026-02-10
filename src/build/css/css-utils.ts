import type { TemplateChildNode } from '@vue/compiler-core'
import { GRADIENT_COLOR_SPACE_RE } from '../../runtime/server/og-image/utils/css'

// ============================================================================
// Lightning CSS lazy loading
// ============================================================================

let transform: typeof import('lightningcss').transform
let Features: typeof import('lightningcss').Features

const LEGACY_TARGETS = {
  chrome: 60 << 16,
  safari: 10 << 16,
}

export async function loadLightningCss() {
  if (!transform) {
    const lcss = await import('lightningcss')
    transform = lcss.transform
    Features = lcss.Features
  }
  return { transform, Features }
}

/**
 * Shared Lightning CSS transformation logic.
 */
export async function transformWithLightningCss(
  css: string,
  options: {
    minify?: boolean
    filename?: string
    targets?: Record<string, number>
    include?: number
  } = {},
) {
  const { transform } = await loadLightningCss()
  const {
    minify = true,
    filename = 'input.css',
    targets = LEGACY_TARGETS,
    include,
  } = options

  const transformOptions: any = {
    filename,
    code: Buffer.from(css),
    minify,
    targets,
    drafts: { customMedia: true },
  }
  if (include !== undefined)
    transformOptions.include = include

  return transform(transformOptions)
}

// ============================================================================
// CSS parsing utilities
// ============================================================================

/**
 * Extract CSS declarations from a CSS block body.
 */
function extractDeclarations(body: string, onDeclaration: (prop: string, value: string) => void) {
  const declRe = /([\w-]+)\s*:\s*([^\s;][^;]*)(?:;|$)/g
  for (const match of body.matchAll(declRe)) {
    if (match[1] && match[2])
      onDeclaration(match[1], match[2].trim())
  }
}

/**
 * Iterate over CSS blocks matching a selector pattern.
 */
function walkBlockRules(css: string, selectorRe: RegExp, onBlock: (body: string) => void) {
  for (const match of css.matchAll(selectorRe)) {
    if (match[1])
      onBlock(match[1])
  }
}

/**
 * Iterate over simple class rules in a CSS string.
 */
function walkClassRules(css: string, onRule: (className: string, body: string) => void) {
  const ruleRe = /\.((?:\\[0-9a-f]{1,6}\s?|\\[^0-9a-f]|[^\\\s{])+)\s*\{([^}]+)\}/gi
  for (const match of css.matchAll(ruleRe)) {
    const rawSelector = match[1]!
    if (isSimpleClassSelector(rawSelector))
      onRule(decodeCssClassName(rawSelector), match[2]!)
  }
}

/**
 * Simplify CSS using Lightning CSS with minification.
 */
export async function simplifyCss(css: string): Promise<string> {
  const result = await transformWithLightningCss(css, { minify: true })
  return result.code.toString()
}

export function extractCssVars(css: string): Map<string, string> {
  const vars = new Map<string, string>()
  walkBlockRules(css, /:(?:root|host)\s*\{([^}]+)\}/g, (body) => {
    extractDeclarations(body, (prop, value) => {
      if (prop.startsWith('--'))
        vars.set(prop, value)
    })
  })
  return vars
}

export function extractUniversalVars(css: string): Map<string, string> {
  const vars = new Map<string, string>()
  walkBlockRules(css, /\*[^{]*\{([^}]+)\}/g, (body) => {
    extractDeclarations(body, (prop, value) => {
      if (prop.startsWith('--'))
        vars.set(prop, value)
    })
  })
  return vars
}

export function extractPropertyInitialValues(css: string): Map<string, string> {
  const vars = new Map<string, string>()
  const propertyRe = /@property\s+(--[\w-]+)\s*\{([^}]+)\}/g
  for (const match of css.matchAll(propertyRe)) {
    const initialMatch = match[2]!.match(/initial-value\s*:\s*([^\s;][^;]*);?/)
    if (initialMatch?.[1])
      vars.set(match[1]!, initialMatch[1].trim())
  }
  return vars
}

export function extractPerClassVars(css: string): Map<string, Map<string, string>> {
  const result = new Map<string, Map<string, string>>()
  walkClassRules(css, (className, body) => {
    const classVars = new Map<string, string>()
    extractDeclarations(body, (prop, value) => {
      if (prop.startsWith('--'))
        classVars.set(prop, value)
    })
    if (classVars.size > 0)
      result.set(className, classVars)
  })
  return result
}

// ============================================================================
// Variable resolution
// ============================================================================

export function resolveCssVars(css: string, vars: Map<string, string>): string {
  let result = css
  let iterations = 0
  while (result.includes('var(') && iterations < 20) {
    const next = resolveInnermostVar(result, vars)
    if (next === result)
      break
    result = next
    iterations++
  }
  return result
}

function findClosingParen(str: string, startIdx: number): number {
  let depth = 1
  for (let i = startIdx; i < str.length; i++) {
    if (str[i] === '(') {
      depth++
    }
    else if (str[i] === ')') {
      if (--depth === 0)
        return i
    }
  }
  return -1
}

function resolveInnermostVar(css: string, vars: Map<string, string>): string {
  const idx = css.lastIndexOf('var(')
  if (idx === -1)
    return css
  const closeIdx = findClosingParen(css, idx + 4)
  if (closeIdx === -1)
    return css
  const content = css.substring(idx + 4, closeIdx)
  if (content.includes('var('))
    return css
  const comma = content.indexOf(',')
  const name = (comma >= 0 ? content.substring(0, comma) : content).trim()
  const fallback = comma >= 0 ? content.substring(comma + 1).trim() : undefined
  const resolved = vars.get(name) ?? fallback ?? ''
  return css.substring(0, idx) + resolved + css.substring(closeIdx + 1)
}

// ============================================================================
// Selector utilities
// ============================================================================

export function decodeCssClassName(selector: string): string {
  let className = selector.startsWith('.') ? selector.slice(1) : selector
  className = className.replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex) =>
    String.fromCodePoint(Number.parseInt(hex, 16)))
  return className.replace(/\\(.)/g, '$1')
}

export function isSimpleClassSelector(selector: string): boolean {
  const withoutEscapes = selector.replace(/\\[0-9a-f]{1,6}\s?/gi, '_').replace(/\\./g, '_')
  return !/[\s>+~]/.test(withoutEscapes) && !/:[a-z]/i.test(withoutEscapes)
}

export interface ExtractClassStylesOptions {
  camelCase?: boolean
  skipPrefixes?: string[]
  merge?: boolean
  collectVars?: Map<string, string>
}

export function extractClassStyles(
  css: string,
  options: ExtractClassStylesOptions = {},
): Map<string, Record<string, string>> {
  const { camelCase = false, skipPrefixes = ['--'], merge = false, collectVars } = options
  const classes = new Map<string, Record<string, string>>()

  walkClassRules(css, (className, body) => {
    const styles: Record<string, string> = merge ? (classes.get(className) || {}) : {}
    extractDeclarations(body, (prop, value) => {
      if (prop.startsWith('--')) {
        if (collectVars)
          collectVars.set(prop, value)
        if (skipPrefixes.some(p => prop.startsWith(p)))
          return
      }
      else if (skipPrefixes.some(p => prop.startsWith(p))) {
        return
      }
      const finalProp = camelCase ? prop.replace(/-([a-z])/g, (_, l) => l.toUpperCase()) : prop
      styles[finalProp] = value
    })
    if (Object.keys(styles).length)
      classes.set(className, styles)
  })
  return classes
}

// ============================================================================
// Font family utilities
// ============================================================================

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
  'revert',
  'revert-layer',
])

export function extractCustomFontFamilies(cssValue: string): string[] {
  return cssValue
    .replace(/\s*!important\s*$/, '')
    .split(',')
    .map(p => p.trim().replace(/^['"]|['"]$/g, ''))
    .filter(name => name && !GENERIC_FONT_FAMILIES.has(name.toLowerCase()) && !/^\d+$/.test(name) && !name.startsWith('var('))
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
  const result = await simplifyCss(`.x{width:${value}}`)
  return result.match(/width:([^;}]+)/)?.[1]?.trim() ?? value
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
  return result.includes('var(') && depth < 10
    ? resolveVarsDeep(result, vars, depth + 1)
    : evaluateCalc(result)
}

// ============================================================================
// Post-processing pipeline
// ============================================================================

/**
 * Downlevel a CSS color value to hex/rgba using Lightning CSS.
 */
export async function downlevelColor(prop: string, value: string): Promise<string> {
  if (!value || value.includes('var('))
    return value
  try {
    const result = await transformWithLightningCss(`.x{${prop}:${value}}`, { minify: true })
    const output = result.code.toString()
    // Extract the first value (fallback) from minified output .x{prop:val1;prop:val2}
    const match = output.match(new RegExp(`[{;]${prop}:(.*?)[;}]`))
    return match?.[1]?.trim() ?? value
  }
  catch {
    return value
  }
}

/**
 * Convert individual transform properties to shorthand transform for Satori.
 */
export function convertIndividualTransforms(styles: Record<string, string>): void {
  const parts: string[] = []
  if (styles.translate) {
    const vals = styles.translate.trim().split(/\s+/)
    parts.push(vals.length === 2 ? `translate(${vals[0]}, ${vals[1]})` : `translateX(${vals[0]})`)
    delete styles.translate
  }
  if (styles.rotate) {
    parts.push(`rotate(${styles.rotate})`)
    delete styles.rotate
  }
  if (styles.scale) {
    const vals = styles.scale.trim().split(/\s+/).filter(Boolean)
    parts.push(`scale(${vals.join(', ')})`)
    delete styles.scale
  }
  if (parts.length > 0) {
    styles.transform = styles.transform ? `${parts.join(' ')} ${styles.transform}` : parts.join(' ')
  }
}

/**
 * Expand logical properties to physical longhands for Satori.
 */
export function convertLogicalProperties(styles: Record<string, string>): void {
  const mapping = [
    ['inset', ['top', 'right', 'bottom', 'left']],
    ['inset-inline', ['left', 'right']],
    ['inset-block', ['top', 'bottom']],
    ['padding-inline', ['padding-left', 'padding-right']],
    ['padding-block', ['padding-top', 'padding-bottom']],
    ['margin-inline', ['margin-left', 'margin-right']],
    ['margin-block', ['margin-top', 'margin-bottom']],
  ] as const
  for (const [logical, physicals] of mapping) {
    if (styles[logical]) {
      const v = styles[logical]
      for (const phys of physicals) styles[phys] ??= v
      delete styles[logical]
    }
  }
}

function stripGradientColorSpace(value: string): string {
  return value.replace(GRADIENT_COLOR_SPACE_RE, '')
}

/**
 * Shared post-processing pipeline for resolved CSS styles.
 * Handles: resolve vars → skip unresolvable → downlevel colors → transforms → logical props.
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

    if (value.includes('var(') || /^(?:initial|inherit|unset|revert|revert-layer)$/.test(value))
      continue
    if (/calc\(\s*[*/]/.test(value))
      continue

    if (value.includes(',')) {
      const cleaned = value.split(',').map(s => s.trim()).filter(Boolean).join(', ')
      if (!cleaned)
        continue
      value = cleaned
    }

    // Downlevel modern colors
    if (/color|fill|stroke|outline|border|background|caret|accent/.test(prop)) {
      value = await downlevelColor(prop, value)
    }

    if (prop === 'background-image' && value.includes('-gradient('))
      value = stripGradientColorSpace(value)

    styles[prop] = value
  }

  convertIndividualTransforms(styles)
  convertLogicalProperties(styles)

  return Object.keys(styles).length ? styles : null
}

// ============================================================================
// Template utilities
// ============================================================================

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
