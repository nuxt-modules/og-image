import { readFile } from 'node:fs/promises'
import { dirname, join } from 'pathe'
import postcss from 'postcss'
import { buildNuxtUiVars, COLOR_PROPERTIES, convertColorToHex } from './tw4-utils'

export type Tw4FontVars = Record<string, string>
export type Tw4Breakpoints = Record<string, number>
export type Tw4Colors = Record<string, string | Record<string, string>>

export interface Tw4Metadata {
  fontVars: Tw4FontVars
  breakpoints: Tw4Breakpoints
  colors: Tw4Colors
}

// Compiler instance cache
let cachedCompiler: Awaited<ReturnType<typeof import('tailwindcss').compile>> | null = null
let cachedCssPath: string | null = null
let cachedVars: Map<string, string> | null = null

// Cache for style resolution (class -> style object)
const resolvedStyleCache = new Map<string, Record<string, string> | null>()

export interface Tw4ResolverOptions {
  cssPath: string
  nuxtUiColors?: Record<string, string>
}

async function getCompiler(cssPath: string, nuxtUiColors?: Record<string, string>) {
  if (cachedCompiler && cachedCssPath === cssPath)
    return { compiler: cachedCompiler, vars: cachedVars! }

  const { compile } = await import('tailwindcss')
  const userCss = await readFile(cssPath, 'utf-8')
  const baseDir = dirname(cssPath)

  const compiler = await compile(userCss, {
    loadStylesheet: async (id: string, base: string) => {
      if (id === 'tailwindcss') {
        const { resolveModulePath } = await import('exsolve')
        const twPath = resolveModulePath('tailwindcss/index.css', { from: baseDir })
        if (twPath) {
          const content = await readFile(twPath, 'utf-8').catch(() => '')
          if (content)
            return { path: twPath, base: dirname(twPath), content }
        }
        return {
          path: 'virtual:tailwindcss',
          base,
          content: '@layer theme, base, components, utilities;\n@layer utilities { @tailwind utilities; }',
        }
      }
      if (id.startsWith('./') || id.startsWith('../')) {
        const resolved = join(base || baseDir, id)
        const content = await readFile(resolved, 'utf-8').catch(() => '')
        return { path: resolved, base: dirname(resolved), content }
      }
      const { resolveModulePath } = await import('exsolve')
      const resolved = resolveModulePath(id, { from: base || baseDir, conditions: ['style'] })
      if (resolved) {
        const content = await readFile(resolved, 'utf-8').catch(() => '')
        return { path: resolved, base: dirname(resolved), content }
      }
      return { path: id, base, content: '' }
    },
  })

  const vars = new Map<string, string>()

  // Add Nuxt UI color fallbacks
  if (nuxtUiColors)
    await buildNuxtUiVars(vars, nuxtUiColors)

  cachedCompiler = compiler
  cachedCssPath = cssPath
  cachedVars = vars
  resolvedStyleCache.clear()

  return { compiler, vars }
}

/**
 * Parse TW4 compiler output using postcss.
 * Extracts CSS variables and class styles reliably.
 */
function parseCssOutput(css: string, vars: Map<string, string>): Map<string, Record<string, string>> {
  const classes = new Map<string, Record<string, string>>()

  const root = postcss.parse(css)

  // Extract :root/:host variables
  root.walkRules((rule) => {
    if (rule.selector.includes(':root') || rule.selector.includes(':host')) {
      rule.walkDecls((decl) => {
        if (decl.prop.startsWith('--') && !vars.has(decl.prop))
          vars.set(decl.prop, decl.value)
      })
    }
  })

  // Extract class styles
  root.walkRules((rule) => {
    const sel = rule.selector
    // Only process simple class selectors (not pseudo-classes, combinators, etc.)
    if (!sel.startsWith('.') || sel.includes(':') || sel.includes(' ') || sel.includes('>'))
      return

    // Handle escaped characters in class names
    // - .\32xl -> 2xl (hex escapes)
    // - .m-0\.5 -> m-0.5 (escaped special chars)
    let className = sel.slice(1)
    // First handle hex escapes like \32 -> '2'
    className = className.replace(/\\([0-9a-f]+)\s?/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    // Then handle escaped special chars like \. -> .
    className = className.replace(/\\(.)/g, '$1')

    const styles: Record<string, string> = {}
    rule.walkDecls((decl) => {
      // Skip internal TW CSS variables
      if (decl.prop.startsWith('--tw-'))
        return
      styles[decl.prop] = decl.value
    })

    if (Object.keys(styles).length)
      classes.set(className, styles)
  })

  return classes
}

/**
 * Safely evaluate simple arithmetic expressions without using eval/Function.
 * Supports: +, -, *, / with proper operator precedence.
 */
function safeEvaluateArithmetic(expr: string): number | null {
  // Tokenize: numbers and operators only
  const tokens = expr.match(/[\d.]+|[+\-*/]/g)
  if (!tokens)
    return null

  const numbers: number[] = []
  const operators: string[] = []

  const applyOperator = () => {
    const op = operators.pop()
    const b = numbers.pop()
    const a = numbers.pop()
    if (a === undefined || b === undefined || !op)
      return false
    switch (op) {
      case '+':
        numbers.push(a + b)
        break
      case '-':
        numbers.push(a - b)
        break
      case '*':
        numbers.push(a * b)
        break
      case '/':
        numbers.push(b !== 0 ? a / b : 0)
        break
      default:
        return false
    }
    return true
  }

  const precedence = (op: string) => (op === '+' || op === '-') ? 1 : 2

  for (const token of tokens) {
    if (/^[\d.]+$/.test(token)) {
      const num = Number.parseFloat(token)
      if (Number.isNaN(num))
        return null
      numbers.push(num)
    }
    else {
      while (operators.length && precedence(operators[operators.length - 1]!) >= precedence(token)) {
        if (!applyOperator())
          return null
      }
      operators.push(token)
    }
  }

  while (operators.length) {
    if (!applyOperator())
      return null
  }

  return numbers.length === 1 ? numbers[0]! : null
}

/**
 * Evaluate simple calc() expressions that Satori can't handle.
 * e.g., calc(1 / 0.75) -> 1.333...
 */
function evaluateCalc(value: string): string {
  return value.replace(/calc\(([^)]+)\)/g, (match, expr) => {
    // Only evaluate simple arithmetic (no units in the expression itself)
    if (/^[\d.+\-*/\s]+$/.test(expr)) {
      const result = safeEvaluateArithmetic(expr)
      if (result !== null && Number.isFinite(result))
        return String(result)
    }
    return match
  })
}

/**
 * Parse a var() expression handling nested parentheses in fallbacks.
 * Returns { varName, fallback, endIndex } or null if not a valid var().
 */
function parseVarExpression(value: string, startIndex: number): { varName: string, fallback: string | null, endIndex: number } | null {
  if (!value.startsWith('var(', startIndex))
    return null

  let depth = 1
  let i = startIndex + 4 // Skip 'var('
  let varName = ''
  let fallback: string | null = null
  let inFallback = false

  // Extract variable name (until comma or closing paren)
  while (i < value.length && depth > 0) {
    const char = value[i]
    if (char === '(') {
      depth++
      if (inFallback)
        fallback += char
    }
    else if (char === ')') {
      depth--
      if (depth > 0 && inFallback)
        fallback += char
    }
    else if (char === ',' && depth === 1 && !inFallback) {
      inFallback = true
      fallback = ''
      i++
      // Skip whitespace after comma
      while (i < value.length && value[i] === ' ')
        i++
      continue
    }
    else if (inFallback && char) {
      fallback += char
    }
    else {
      varName += char
    }
    i++
  }

  if (depth !== 0 || !varName.startsWith('--'))
    return null

  return {
    varName: varName.trim(),
    fallback: fallback?.trim() || null,
    endIndex: i,
  }
}

/**
 * Resolve var() references in a value string.
 * Handles nested vars, fallbacks with parentheses, and calc() expressions.
 */
function resolveVars(value: string, vars: Map<string, string>, depth = 0): string {
  if (depth > 10 || !value.includes('var('))
    return evaluateCalc(value)

  // Handle calc(var(--name) * N) pattern first
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

  // Find and replace var() references one at a time
  let result = value
  let iterations = 0
  const maxIterations = 50

  while (result.includes('var(') && iterations < maxIterations) {
    const varIndex = result.indexOf('var(')
    if (varIndex === -1)
      break

    const parsed = parseVarExpression(result, varIndex)
    if (!parsed) {
      // Invalid var(), skip past it to avoid infinite loop
      result = result.slice(0, varIndex) + result.slice(varIndex + 4)
      iterations++
      continue
    }

    const resolved = vars.get(parsed.varName) ?? parsed.fallback
    if (resolved) {
      result = result.slice(0, varIndex) + resolved + result.slice(parsed.endIndex)
    }
    else {
      // Can't resolve, remove the var() to avoid infinite loop
      result = result.slice(0, varIndex) + result.slice(parsed.endIndex)
    }
    iterations++
  }

  // Recursively resolve any newly introduced var() references
  if (result.includes('var(') && depth < 10)
    return resolveVars(result, vars, depth + 1)

  return evaluateCalc(result)
}

/**
 * Convert oklch colors in gradient values to hex.
 */
function convertGradientColors(value: string): string {
  return value.replace(/oklch\([^)]+\)/g, (match) => {
    const hex = convertColorToHex(match)
    return hex.startsWith('#') ? hex : match
  })
}

// Linear gradient direction mapping
const LINEAR_GRADIENT_DIRECTIONS: Record<string, string> = {
  'bg-gradient-to-t': 'to top',
  'bg-gradient-to-tr': 'to top right',
  'bg-gradient-to-r': 'to right',
  'bg-gradient-to-br': 'to bottom right',
  'bg-gradient-to-b': 'to bottom',
  'bg-gradient-to-bl': 'to bottom left',
  'bg-gradient-to-l': 'to left',
  'bg-gradient-to-tl': 'to top left',
}

// Radial gradient shape/position mapping
const RADIAL_GRADIENT_SHAPES: Record<string, string> = {
  'bg-radial': 'circle at center',
  'bg-radial-at-t': 'circle at top',
  'bg-radial-at-tr': 'circle at top right',
  'bg-radial-at-r': 'circle at right',
  'bg-radial-at-br': 'circle at bottom right',
  'bg-radial-at-b': 'circle at bottom',
  'bg-radial-at-bl': 'circle at bottom left',
  'bg-radial-at-l': 'circle at left',
  'bg-radial-at-tl': 'circle at top left',
  'bg-radial-at-c': 'circle at center',
}

/**
 * Resolve gradient color from class name using theme vars.
 */
function resolveGradientColor(cls: string, vars: Map<string, string>): string | null {
  const colorName = cls.replace(/^(from|via|to)-/, '')

  // Check for color with shade (e.g., from-red-500)
  const shadeMatch = colorName.match(/^(.+)-(\d+)$/)
  if (shadeMatch?.[1] && shadeMatch?.[2]) {
    const varName = `--color-${shadeMatch[1]}-${shadeMatch[2]}`
    const value = vars.get(varName)
    if (value) {
      const resolved = resolveVars(value, vars)
      if (!resolved.includes('var('))
        return convertColorToHex(resolved)
    }
  }

  // Check for single color (e.g., from-brand)
  const varName = `--color-${colorName}`
  const value = vars.get(varName)
  if (value) {
    const resolved = resolveVars(value, vars)
    if (!resolved.includes('var('))
      return convertColorToHex(resolved)
  }

  return null
}

/**
 * Build gradient CSS from combination of classes.
 * TW4 gradients use cascading --tw-* vars that are hard to resolve statically,
 * so we manually construct the gradient from the component classes.
 */
function buildGradient(
  classes: string[],
  vars: Map<string, string>,
): { gradientClass: string, value: string, colorClasses: string[] } | null {
  const linearDir = classes.find(c => LINEAR_GRADIENT_DIRECTIONS[c])
  const radialShape = classes.find(c => RADIAL_GRADIENT_SHAPES[c])
  const fromClass = classes.find(c => c.startsWith('from-'))
  const viaClass = classes.find(c => c.startsWith('via-'))
  // to-* for colors, but NOT to-t/b/l/r/tl/tr/bl/br (inset positions)
  const toClass = classes.find(c => c.startsWith('to-') && !/^to-(?:[tblr]|tl|tr|bl|br)$/.test(c))

  if (!linearDir && !radialShape)
    return null
  if (!fromClass && !toClass)
    return null

  const fromColor = fromClass ? resolveGradientColor(fromClass, vars) : null
  const viaColor = viaClass ? resolveGradientColor(viaClass, vars) : null
  const toColor = toClass ? resolveGradientColor(toClass, vars) : null

  if (!fromColor && !toColor)
    return null

  const stops = [fromColor, viaColor, toColor].filter(Boolean).join(', ')
  const colorClasses = [fromClass, viaClass, toClass].filter((c): c is string => !!c)

  if (linearDir) {
    const direction = LINEAR_GRADIENT_DIRECTIONS[linearDir]
    return {
      gradientClass: linearDir,
      value: `linear-gradient(${direction}, ${stops})`,
      colorClasses,
    }
  }

  if (radialShape) {
    const shape = RADIAL_GRADIENT_SHAPES[radialShape]
    return {
      gradientClass: radialShape,
      value: `radial-gradient(${shape}, ${stops})`,
      colorClasses,
    }
  }

  return null
}

/**
 * Resolve an array of Tailwind classes to their full CSS style declarations.
 * Returns a map of class -> { property: value } for all resolvable classes.
 */
export async function resolveClassesToStyles(
  classes: string[],
  options: Tw4ResolverOptions,
): Promise<Record<string, Record<string, string>>> {
  const { compiler, vars } = await getCompiler(options.cssPath, options.nuxtUiColors)

  // Filter to uncached classes
  const uncached = classes.filter(c => !resolvedStyleCache.has(c))

  if (uncached.length > 0) {
    const outputCss = compiler.build(uncached)

    // Parse with postcss
    const parsedClasses = parseCssOutput(outputCss, vars)

    // Process each parsed class
    for (const [className, rawStyles] of parsedClasses) {
      const styles: Record<string, string> = {}

      for (const [prop, rawValue] of Object.entries(rawStyles)) {
        // Resolve var() references
        let value = resolveVars(rawValue, vars)

        // Skip if still has unresolved vars
        if (value.includes('var('))
          continue

        // Convert colors to hex
        if (COLOR_PROPERTIES.has(prop)) {
          if (prop === 'background-image' && value.includes('gradient')) {
            value = convertGradientColors(value)
          }
          else {
            value = convertColorToHex(value)
          }
        }

        styles[prop] = value
      }

      resolvedStyleCache.set(className, Object.keys(styles).length ? styles : null)
    }

    // Mark unprocessed classes as unresolvable
    for (const c of uncached) {
      if (!resolvedStyleCache.has(c))
        resolvedStyleCache.set(c, null)
    }
  }

  // Build result map
  const result: Record<string, Record<string, string>> = {}
  for (const cls of classes) {
    const resolved = resolvedStyleCache.get(cls)
    if (resolved)
      result[cls] = resolved
  }

  // Handle gradient class combinations (TW4 uses cascading --tw-* vars that are hard to resolve)
  const gradient = buildGradient(classes, vars)
  if (gradient) {
    result[gradient.gradientClass] = { 'background-image': gradient.value }
    // Mark color classes as resolved (they contribute to the gradient)
    for (const colorClass of gradient.colorClasses) {
      result[colorClass] = {}
    }
  }

  return result
}

/**
 * Extract theme metadata (fonts, breakpoints, colors) from Tailwind CSS.
 * Called once at build time for runtime config.
 */
export async function extractTw4Metadata(options: Tw4ResolverOptions): Promise<Tw4Metadata> {
  const { compiler, vars } = await getCompiler(options.cssPath, options.nuxtUiColors)

  // Build empty to get theme vars
  const themeCss = compiler.build([])
  parseCssOutput(themeCss, vars)

  const fontVars: Tw4FontVars = {}
  const breakpoints: Tw4Breakpoints = {}
  const colors: Tw4Colors = {}

  for (const [name, value] of vars) {
    const resolvedValue = resolveVars(value, vars)

    if (name.startsWith('--font-')) {
      fontVars[name.slice(2)] = resolvedValue
    }
    else if (name.startsWith('--breakpoint-')) {
      const px = Number.parseInt(resolvedValue.replace('px', ''), 10)
      if (!Number.isNaN(px))
        breakpoints[name.slice(13)] = px
    }
    else if (name.startsWith('--color-') && !resolvedValue.includes('var(')) {
      const colorPath = name.slice(8)
      const shadeMatch = colorPath.match(/^(.+)-(\d+)$/)
      const hexValue = convertColorToHex(resolvedValue)

      if (shadeMatch) {
        const [, colorName, shade] = shadeMatch
        if (colorName) {
          if (!colors[colorName])
            colors[colorName] = {}
          if (typeof colors[colorName] === 'object')
            (colors[colorName] as Record<string, string>)[shade!] = hexValue
        }
      }
      else {
        colors[colorPath] = hexValue
      }
    }
  }

  return { fontVars, breakpoints, colors }
}

/** Clear the compiler cache (useful for HMR) */
export function clearTw4Cache() {
  cachedCompiler = null
  cachedCssPath = null
  cachedVars = null
  resolvedStyleCache.clear()
}
