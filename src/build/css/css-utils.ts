import type { TemplateChildNode } from '@vue/compiler-core'
import { logger } from '../../runtime/logger'
import { GRADIENT_COLOR_SPACE_RE, resolveColorMix } from '../../runtime/server/og-image/utils/css'

const _warnedVars = new Set<string>()

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

  const transformOptions: Parameters<typeof transform>[0] = {
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
 * Within a minified rule, duplicate properties are lightningcss
 * progressive-enhancement fallbacks — keep the first (legacy) value.
 */
function extractDeclarations(body: string, onDeclaration: (prop: string, value: string) => void) {
  const declRe = /([\w-]+)\s*:\s*([^\s;][^;]*)(?:;|$)/g
  const seen = new Set<string>()
  for (const match of body.matchAll(declRe)) {
    if (match[1] && match[2] && !seen.has(match[1])) {
      seen.add(match[1])
      onDeclaration(match[1], match[2].trim())
    }
  }
  // CSS space toggle pattern: --custom-prop: ; (value is a single space)
  // Used by UnoCSS/Tailwind for conditional shadow-inset, ring-inset, etc.
  const toggleRe = /(--[\w-]+)\s*:\s+;/g
  for (const match of body.matchAll(toggleRe)) {
    if (match[1] && !seen.has(match[1])) {
      seen.add(match[1])
      onDeclaration(match[1], ' ')
    }
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

/**
 * Strip `@supports` blocks from minified CSS.
 * Lightning CSS emits progressive-enhancement blocks (e.g. lab() colors inside @supports)
 * alongside legacy fallbacks. We only need the legacy values for OG image renderers.
 */
export function stripAtSupports(css: string): string {
  let result = css
  let idx: number
  // eslint-disable-next-line no-cond-assign
  while ((idx = result.indexOf('@supports')) !== -1) {
    // Find the opening brace of the @supports block (skip the condition with nested parens)
    const braceStart = result.indexOf('{', idx)
    if (braceStart === -1)
      break
    // Find matching closing brace
    let depth = 1
    let i = braceStart + 1
    while (i < result.length && depth > 0) {
      if (result[i] === '{')
        depth++
      else if (result[i] === '}')
        depth--
      i++
    }
    if (depth !== 0)
      break
    result = result.slice(0, idx) + result.slice(i)
  }
  return result
}

export function extractCssVars(css: string): Map<string, string> {
  const vars = new Map<string, string>()
  // Match :root or :host with any compound selectors (e.g. :root[data-theme='dark'], :root:not(...))
  walkBlockRules(css, /:(?:root|host)[^\s{]*\s*\{([^}]+)\}/g, (body) => {
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
// AST-based CSS extraction (single-pass via lightningcss visitor)
// ============================================================================

/**
 * Serialize lightningcss TokenOrValue[] back to a CSS string.
 */
export function serializeTokens(tokens: any[]): string {
  const parts: string[] = []
  for (const tov of tokens) {
    switch (tov.type) {
      case 'token':
        parts.push(serializeToken(tov.value))
        break
      case 'color':
        parts.push(serializeColor(tov.value))
        break
      case 'unresolved-color':
        parts.push(serializeUnresolvedColor(tov.value))
        break
      case 'var':
        parts.push(`var(${tov.value.name.ident}${tov.value.fallback ? `, ${serializeTokens(tov.value.fallback)}` : ''})`)
        break
      case 'env':
        parts.push(`env(${serializeEnvName(tov.value.name)}${tov.value.fallback ? `, ${serializeTokens(tov.value.fallback)}` : ''})`)
        break
      case 'function':
        parts.push(`${tov.value.name}(${serializeTokens(tov.value.arguments)})`)
        break
      case 'length':
        parts.push(`${tov.value.value}${tov.value.unit}`)
        break
      case 'angle':
        parts.push(`${tov.value.value}${tov.value.type}`)
        break
      case 'time':
        parts.push(`${tov.value.value}${tov.value.type === 'seconds' ? 's' : 'ms'}`)
        break
      case 'resolution':
        parts.push(`${tov.value.value}${tov.value.type}`)
        break
      case 'percentage':
        parts.push(`${tov.value * 100}%`)
        break
      case 'dashed-ident':
        parts.push(tov.value)
        break
      case 'url':
        parts.push(`url(${tov.value.url})`)
        break
      case 'animation-name':
        parts.push(typeof tov.value === 'string' ? tov.value : tov.value.value || '')
        break
    }
  }
  return parts.join('')
}

function serializeToken(token: any): string {
  switch (token.type) {
    case 'ident': return token.value
    case 'number': return String(token.value)
    case 'percentage': return `${token.value * 100}%`
    case 'dimension': return `${token.value}${token.unit}`
    case 'string': return `"${token.value}"`
    case 'hash': case 'id-hash': return `#${token.value}`
    case 'white-space': return ' '
    case 'delim': return token.value
    case 'comma': return ', '
    case 'colon': return ':'
    case 'semicolon': return ';'
    case 'unquoted-url': return token.value
    case 'at-keyword': return `@${token.value}`
    default: return ''
  }
}

function serializeColor(color: any): string {
  if (typeof color === 'string')
    return color // SystemColor
  const a = color.alpha !== undefined && color.alpha !== 1 ? ` / ${color.alpha}` : ''
  switch (color.type) {
    case 'currentcolor': return 'currentColor'
    case 'rgb': return color.alpha !== 1
      ? `rgba(${color.r}, ${color.g}, ${color.b}, ${color.alpha})`
      : `rgb(${color.r}, ${color.g}, ${color.b})`
    case 'hsl': return `hsl(${color.h} ${color.s}% ${color.l}%${a})`
    case 'hwb': return `hwb(${color.h} ${color.w}% ${color.b}%${a})`
    case 'lab': return `lab(${color.l} ${color.a} ${color.b}${a})`
    case 'lch': return `lch(${color.l} ${color.c} ${color.h}${a})`
    case 'oklab': return `oklab(${color.l} ${color.a} ${color.b}${a})`
    case 'oklch': return `oklch(${color.l} ${color.c} ${color.h}${a})`
    case 'light-dark': return `light-dark(${serializeColor(color.light)}, ${serializeColor(color.dark)})`
    default:
      // PredefinedColor (srgb, display-p3, etc.) and xyz
      if ('x' in color)
        return `color(${color.type} ${color.x} ${color.y} ${color.z}${a})`
      if ('r' in color)
        return `color(${color.type} ${color.r} ${color.g} ${color.b}${a})`
      return ''
  }
}

function serializeUnresolvedColor(color: any): string {
  const alpha = serializeTokens(color.alpha)
  switch (color.type) {
    case 'rgb': return `rgb(${color.r}, ${color.g}, ${color.b}, ${alpha})`
    case 'hsl': return `hsl(${color.h} ${color.s}% ${color.l}% / ${alpha})`
    case 'light-dark': return `light-dark(${serializeTokens(color.light)}, ${serializeTokens(color.dark)})`
    default: return ''
  }
}

function serializeEnvName(name: any): string {
  if (name.type === 'ua')
    return name.value
  return name.ident || ''
}

export interface SelectorAttrReq {
  name: string
  value: string
  negated: boolean
}

/**
 * Result of single-pass CSS variable extraction.
 * Root vars are plain :root; qualifiedRules carry attribute requirements.
 */
export interface ExtractedCssVars {
  /** Vars from plain :root {} (no theme qualifier) */
  rootVars: Map<string, string>
  /** Rules with attribute requirements (e.g. :root[data-theme='dark'][data-bg-theme='slate']) */
  qualifiedRules: Array<{ reqs: SelectorAttrReq[], vars: Map<string, string> }>
  universalVars: Map<string, string>
  propertyInitials: Map<string, string>
  perClassVars: Map<string, Map<string, string>>
}

/**
 * Resolve extracted vars for a given set of root attributes.
 * Base vars are overlaid with matching qualified rules (fewer reqs first).
 */
export function resolveExtractedVars(extracted: ExtractedCssVars, rootAttrs: Record<string, string>): Map<string, string> {
  const vars = new Map(extracted.rootVars)
  // Sort by specificity: fewer reqs first so more-specific rules overlay later
  const sorted = [...extracted.qualifiedRules].sort((a, b) => a.reqs.length - b.reqs.length)
  for (const rule of sorted) {
    const matches = rule.reqs.every((req) => {
      const actual = rootAttrs[req.name]
      return req.negated ? actual !== req.value : actual === req.value
    })
    if (matches) {
      for (const [name, value] of rule.vars)
        vars.set(name, value)
    }
  }
  return vars
}

/**
 * Check if any selector component in a selector list matches a predicate.
 */
function selectorsContain(selectors: any[], predicate: (component: any) => boolean): boolean {
  for (const selector of selectors) {
    for (const component of selector) {
      if (predicate(component))
        return true
    }
  }
  return false
}

function isRootOrHost(selectors: any[]): boolean {
  return selectorsContain(selectors, c =>
    c.type === 'pseudo-class' && (c.kind === 'root' || c.kind === 'host'))
}

function isUniversal(selectors: any[]): boolean {
  return selectorsContain(selectors, c => c.type === 'universal')
}

/**
 * Extract attribute requirements from a single selector's components.
 * Maps class selectors (.dark/.light) to data-theme equivalents.
 * Returns empty array for plain :root.
 */
function extractSingleSelectorReqs(components: any[]): SelectorAttrReq[] {
  const reqs: SelectorAttrReq[] = []
  for (const component of components) {
    // :root.dark or :root.light → data-theme equivalents
    if (component.type === 'class') {
      if (component.name === 'dark' || component.name === 'light')
        reqs.push({ name: 'data-theme', value: component.name, negated: false })
    }
    // :root[data-theme='dark'], :root[data-bg-theme='slate'], etc.
    if (component.type === 'attribute' && component.operation) {
      const name = component.name as string
      const value = component.operation.value as string
      if (name && value)
        reqs.push({ name, value, negated: false })
    }
    // :not([data-theme='light']) → negated requirement
    if (component.type === 'pseudo-class' && component.kind === 'not') {
      for (const innerSelector of (component.selectors || [])) {
        const innerReqs = extractSingleSelectorReqs(innerSelector)
        for (const req of innerReqs)
          reqs.push({ ...req, negated: !req.negated })
      }
    }
  }
  return reqs
}

/**
 * Extract attribute requirements per selector in a selector list.
 * Comma-separated selectors are treated independently (OR semantics).
 * Returns one SelectorAttrReq[] per selector.
 */
function extractSelectorAttrReqsList(selectors: any[]): SelectorAttrReq[][] {
  return selectors.map((selector: any[]) => extractSingleSelectorReqs(selector))
}

function getSimpleClassName(selectors: any[]): string | undefined {
  // Only match simple single-class selectors (no combinators, no pseudo-classes besides the class)
  if (selectors.length !== 1)
    return undefined
  const selector = selectors[0]
  if (selector.length !== 1)
    return undefined
  const component = selector[0]
  return component.type === 'class' ? component.name : undefined
}

function extractCustomProps(declarations: any): Map<string, string> {
  const vars = new Map<string, string>()
  for (const decl of declarations?.declarations || []) {
    if (decl.property === 'custom') {
      const name = decl.value.name as string
      if (name.startsWith('--'))
        vars.set(name, serializeTokens(decl.value.value).trim())
    }
  }
  return vars
}

function extractPropertyInitialValue(rule: any): { name: string, value: string } | undefined {
  if (!rule.initialValue)
    return undefined
  const name = rule.name as string
  const iv = rule.initialValue
  // ParsedComponent → CSS string
  let value: string
  switch (iv.type) {
    case 'length':
      value = `${iv.value.value}${iv.value.unit}`
      break
    case 'number':
      value = String(iv.value)
      break
    case 'percentage':
      value = `${iv.value * 100}%`
      break
    case 'color':
      value = serializeColor(iv.value)
      break
    case 'string':
      value = iv.value
      break
    case 'token':
      value = serializeTokens([iv])
      break
    default:
      value = serializeTokens(iv.value ? [iv] : [])
      break
  }
  return value ? { name, value: value.trim() } : undefined
}

/**
 * Extract all CSS variable sources in a single lightningcss pass.
 * Replaces extractCssVars + extractUniversalVars + extractPropertyInitialValues + extractPerClassVars.
 */
export async function extractVarsFromCss(css: string): Promise<ExtractedCssVars> {
  const rootVars = new Map<string, string>()
  const qualifiedRules: ExtractedCssVars['qualifiedRules'] = []
  const universalVars = new Map<string, string>()
  const propertyInitials = new Map<string, string>()
  const perClassVars = new Map<string, Map<string, string>>()

  try {
    const { transform } = await loadLightningCss()
    transform({
      filename: 'vars.css',
      code: Buffer.from(css),
      minify: false,
      errorRecovery: true,
      visitor: {
        Rule: {
          style: (rule: any) => {
            const selectors = rule.value.selectors
            const declarations = rule.value.declarations

            if (isRootOrHost(selectors)) {
              const vars = extractCustomProps(declarations)
              if (vars.size === 0)
                return undefined
              // Each selector in a comma-separated list is independent (OR semantics)
              const perSelectorReqs = extractSelectorAttrReqsList(selectors)
              const hasUnqualified = perSelectorReqs.some(reqs => reqs.length === 0)
              if (hasUnqualified) {
                // At least one plain :root selector — treat as root vars
                for (const [name, value] of vars)
                  rootVars.set(name, value)
              }
              // Push each qualified selector as its own rule
              for (const reqs of perSelectorReqs) {
                if (reqs.length > 0)
                  qualifiedRules.push({ reqs, vars })
              }
            }
            else if (isUniversal(selectors)) {
              for (const [name, value] of extractCustomProps(declarations))
                universalVars.set(name, value)
            }
            else {
              const className = getSimpleClassName(selectors)
              if (className) {
                const classVarMap = extractCustomProps(declarations)
                if (classVarMap.size > 0) {
                  const decoded = decodeCssClassName(className)
                  const existing = perClassVars.get(decoded)
                  if (existing) {
                    for (const [k, v] of classVarMap) existing.set(k, v)
                  }
                  else {
                    perClassVars.set(decoded, classVarMap)
                  }
                }
              }
            }
          },
          property: (rule: any) => {
            const result = extractPropertyInitialValue(rule.value)
            if (result)
              propertyInitials.set(result.name, result.value)
          },
        },
      },
    })
  }
  catch {
    // Fallback to regex-based extraction if lightningcss visitor fails
    // Note: regex fallback does not support qualified rule splitting
    for (const [name, value] of extractCssVars(css))
      rootVars.set(name, value)
    for (const [name, value] of extractUniversalVars(css))
      universalVars.set(name, value)
    for (const [name, value] of extractPropertyInitialValues(css))
      propertyInitials.set(name, value)
    for (const [name, value] of extractPerClassVars(css)) {
      perClassVars.set(name, value)
    }
  }

  return { rootVars, qualifiedRules, universalVars, propertyInitials, perClassVars }
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
  const resolved = vars.get(name) ?? fallback
  if (resolved === undefined)
    return css
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
  // vendor-prefixed system font aliases (not real downloadable fonts)
  '-apple-system',
  'blinkmacsystemfont',
  // platform emoji/symbol fonts (not downloadable)
  'apple color emoji',
  'segoe ui emoji',
  'segoe ui symbol',
  'noto color emoji',
])

function isSystemFont(name: string): boolean {
  return name.startsWith('-') || name.startsWith('var(')
}

export function extractCustomFontFamilies(cssValue: string): string[] {
  return cssValue
    .replace(/\s*!important\s*$/, '')
    .split(',')
    .map(p => p.trim().replace(/^['"]|['"]$/g, ''))
    .filter(name => name && !GENERIC_FONT_FAMILIES.has(name.toLowerCase()) && !/^\d+$/.test(name) && !isSystemFont(name))
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

/**
 * Clamp extreme CSS values that cause renderer issues.
 * e.g. lightningcss evaluates calc(infinity * 1px) → 3.40282e+38px which hangs takumi.
 */
function clampExtremeValues(styles: Record<string, string>): void {
  for (const [prop, value] of Object.entries(styles)) {
    if (!value.includes('e+') && !value.includes('e38'))
      continue
    const match = value.match(/^(-?[\d.]+e\+?\d+)(px|rem|em|%)$/)
    if (match?.[1] && match?.[2]) {
      const num = Number.parseFloat(match[1])
      if (Math.abs(num) > 9999)
        styles[prop] = `9999${match[2]}`
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
  context?: string,
): Promise<Record<string, string> | null> {
  const styles: Record<string, string> = {}
  const resolve = resolveVar || resolveVarsDeep

  for (const [prop, rawValue] of Object.entries(rawStyles)) {
    let value = await resolve(rawValue, vars)

    if (value.includes('var(') || /^(?:initial|inherit|unset|revert|revert-layer)$/.test(value)) {
      // Warn about unresolved CSS variables
      if (value.includes('var(')) {
        const unresolvedVars = [...value.matchAll(/var\((--[\w-]+)/g)].map(m => m[1])
        for (const name of unresolvedVars) {
          const key = `${context || ''}:${name}`
          if (!_warnedVars.has(key)) {
            _warnedVars.add(key)
            logger.warn(`[og-image]${context ? ` ${context}:` : ''} CSS variable ${name} not found, style will be skipped`)
          }
        }
      }
      continue
    }
    if (/calc\(\s*[*/]/.test(value))
      continue

    if (value.includes(',')) {
      const cleaned = value.split(',').map(s => s.trim()).filter(Boolean).join(', ')
      if (!cleaned)
        continue
      value = cleaned
    }

    // Simplify font-family: extract the first custom family name, unwrapped.
    // OG renderers don't do font fallback — generic families (monospace, sans-serif)
    // are noise. Also avoids &quot; encoding in HTML style attributes which breaks
    // parsing when htmlDecodeQuotes() decodes them back to literal " at runtime.
    if (prop === 'font-family') {
      const custom = extractCustomFontFamilies(value)
      if (custom.length) {
        const name = custom[0]!
        // Quote multi-word font names so CSS parses them as a single family
        value = name.includes(' ') ? `'${name}'` : name
      }
    }

    // Downlevel modern colors (Lightning CSS handles standard color-mix with %)
    if (/color|fill|stroke|outline|border|background|caret|accent/.test(prop)) {
      value = await downlevelColor(prop, value)
      // Fallback: resolve color-mix() with non-standard fraction syntax (.14 instead of 14%)
      // that Lightning CSS passes through unchanged
      if (value.includes('color-mix('))
        value = resolveColorMix(value)
    }

    if (prop === 'background-image' && value.includes('-gradient('))
      value = stripGradientColorSpace(value)

    styles[prop] = value
  }

  convertIndividualTransforms(styles)
  convertLogicalProperties(styles)
  clampExtremeValues(styles)

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
