import { readFile } from 'node:fs/promises'
import { resolveModulePath } from 'exsolve'
import { dirname, join } from 'pathe'
import twColors from 'tailwindcss/colors'
import { COLOR_PROPERTIES, convertColorToHex, convertOklchToHex, decodeCssClassName, loadPostcss } from '../css-utils'

// Lazy-loaded heavy dependencies to reduce startup memory
let postcss: typeof import('postcss').default
let postcssCalc: (opts?: object) => import('postcss').Plugin
let postcssCustomProperties: (opts?: object) => import('postcss').Plugin
let compile: typeof import('tailwindcss').compile

async function loadTw4Deps() {
  if (!compile) {
    const [{ postcss: pc, postcssCalc: pcCalc }, postcssCustomPropsModule, tailwindModule] = await Promise.all([
      loadPostcss(),
      import('postcss-custom-properties'),
      import('tailwindcss'),
    ])
    postcss = pc
    postcssCalc = pcCalc
    postcssCustomProperties = postcssCustomPropsModule.default as unknown as typeof postcssCustomProperties
    compile = tailwindModule.compile
  }
}

// ============================================================================
// TW4-specific utilities
// ============================================================================

/**
 * Create a stylesheet loader for the TW4 compiler.
 */
export function createStylesheetLoader(baseDir: string) {
  return async (id: string, base: string) => {
    // Handle tailwindcss import
    if (id === 'tailwindcss') {
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
    // Handle relative imports
    if (id.startsWith('./') || id.startsWith('../')) {
      const resolved = join(base || baseDir, id)
      const content = await readFile(resolved, 'utf-8').catch(() => '')
      return { path: resolved, base: dirname(resolved), content }
    }
    // Handle node_modules imports (e.g., @nuxt/ui)
    const resolved = resolveModulePath(id, { from: base || baseDir, conditions: ['style'] })
    if (resolved) {
      const content = await readFile(resolved, 'utf-8').catch(() => '')
      return { path: resolved, base: dirname(resolved), content }
    }
    return { path: id, base, content: '' }
  }
}

/**
 * Build Nuxt UI CSS variable declarations.
 * Expands semantic color names (e.g., { primary: 'indigo' }) to full CSS variable sets.
 */
export function buildNuxtUiVars(
  vars: Map<string, string>,
  nuxtUiColors: Record<string, string>,
): void {
  const colors = twColors as unknown as Record<string, Record<number, string>>
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

  for (const [semantic, colorName] of Object.entries(nuxtUiColors)) {
    // Add color shades (e.g., --ui-color-primary-500)
    for (const shade of shades) {
      const varName = `--ui-color-${semantic}-${shade}`
      const value = colors[colorName]?.[shade]
      if (value && !vars.has(varName))
        vars.set(varName, value)
    }
    // Add semantic variable (e.g., --ui-primary)
    if (!vars.has(`--ui-${semantic}`))
      vars.set(`--ui-${semantic}`, colors[colorName]?.[500] || '')
  }

  // Add Nuxt UI semantic text/bg/border variables (light mode defaults)
  const neutral = nuxtUiColors.neutral || 'slate'
  const neutralColors = colors[neutral]
  const semanticVars: Record<string, string> = {
    '--ui-text-dimmed': neutralColors?.[400] || '',
    '--ui-text-muted': neutralColors?.[500] || '',
    '--ui-text-toned': neutralColors?.[600] || '',
    '--ui-text': neutralColors?.[700] || '',
    '--ui-text-highlighted': neutralColors?.[900] || '',
    '--ui-text-inverted': '#ffffff',
    '--ui-bg': '#ffffff',
    '--ui-bg-muted': neutralColors?.[50] || '',
    '--ui-bg-elevated': neutralColors?.[100] || '',
    '--ui-bg-accented': neutralColors?.[200] || '',
    '--ui-bg-inverted': neutralColors?.[900] || '',
    '--ui-border': neutralColors?.[200] || '',
    '--ui-border-muted': neutralColors?.[200] || '',
    '--ui-border-accented': neutralColors?.[300] || '',
    '--ui-border-inverted': neutralColors?.[900] || '',
  }
  for (const [name, value] of Object.entries(semanticVars)) {
    if (value && !vars.has(name))
      vars.set(name, value)
  }
}

// ============================================================================
// Compiler cache and state
// ============================================================================

let cachedCompiler: Awaited<ReturnType<typeof import('tailwindcss').compile>> | null = null
let cachedCssPath: string | null = null
let cachedVars: Map<string, string> | null = null
const resolvedStyleCache = new Map<string, Record<string, string> | null>()

/** Clear the compiler cache (useful for HMR) */
export function clearTw4Cache() {
  cachedCompiler = null
  cachedCssPath = null
  cachedVars = null
  resolvedStyleCache.clear()
}

// ============================================================================
// Types
// ============================================================================

export type Tw4FontVars = Record<string, string>
export type Tw4Breakpoints = Record<string, number>
export type Tw4Colors = Record<string, string | Record<string, string>>

export interface Tw4Metadata {
  fontVars: Tw4FontVars
  breakpoints: Tw4Breakpoints
  colors: Tw4Colors
}

export interface Tw4ResolverOptions {
  cssPath: string
  nuxtUiColors?: Record<string, string>
}

export interface StyleMap {
  classes: Map<string, Record<string, string>>
  vars: Map<string, string>
}

export interface GeneratorOptions {
  cssPath: string
  classes: string[]
  nuxtUiColors?: Record<string, string>
}

// ============================================================================
// Core compiler
// ============================================================================

async function getCompiler(cssPath: string, nuxtUiColors?: Record<string, string>) {
  if (cachedCompiler && cachedCssPath === cssPath)
    return { compiler: cachedCompiler, vars: cachedVars! }

  await loadTw4Deps()

  const userCss = await readFile(cssPath, 'utf-8')
  const baseDir = dirname(cssPath)

  const compiler = await compile(userCss, {
    loadStylesheet: createStylesheetLoader(baseDir),
  })

  const vars = new Map<string, string>()

  // Add Nuxt UI color fallbacks
  if (nuxtUiColors)
    buildNuxtUiVars(vars, nuxtUiColors)

  cachedCompiler = compiler
  cachedCssPath = cssPath
  cachedVars = vars
  resolvedStyleCache.clear()

  return { compiler, vars }
}

// ============================================================================
// CSS parsing utilities
// ============================================================================

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

    const className = decodeCssClassName(sel)

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
 * Evaluate calc() expressions using postcss-calc.
 */
function evaluateCalc(value: string): string {
  if (!value.includes('calc('))
    return value

  const fakeCss = `.x{v:${value}}`
  const result = postcss([postcssCalc({})]).process(fakeCss, { from: undefined })
  const match = result.css.match(/\.x\{v:(.+)\}/)
  return match?.[1] ?? value
}

/**
 * Parse a var() expression handling nested parentheses in fallbacks.
 */
function parseVarExpression(value: string, startIndex: number): { varName: string, fallback: string | null, endIndex: number } | null {
  if (!value.startsWith('var(', startIndex))
    return null

  let depth = 1
  let i = startIndex + 4 // Skip 'var('
  let varName = ''
  let fallback: string | null = null
  let inFallback = false

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

  let result = value
  let iterations = 0
  const maxIterations = 50

  while (result.includes('var(') && iterations < maxIterations) {
    const varIndex = result.indexOf('var(')
    if (varIndex === -1)
      break

    const parsed = parseVarExpression(result, varIndex)
    if (!parsed) {
      result = result.slice(0, varIndex) + result.slice(varIndex + 4)
      iterations++
      continue
    }

    const resolved = vars.get(parsed.varName) ?? parsed.fallback
    if (resolved) {
      result = result.slice(0, varIndex) + resolved + result.slice(parsed.endIndex)
    }
    else {
      result = result.slice(0, varIndex) + result.slice(parsed.endIndex)
    }
    iterations++
  }

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

// ============================================================================
// Gradient handling
// ============================================================================

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

function resolveGradientColor(cls: string, vars: Map<string, string>): string | null {
  const colorName = cls.replace(/^(from|via|to)-/, '')

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

  const varName = `--color-${colorName}`
  const value = vars.get(varName)
  if (value) {
    const resolved = resolveVars(value, vars)
    if (!resolved.includes('var('))
      return convertColorToHex(resolved)
  }

  return null
}

function buildGradient(
  classes: string[],
  vars: Map<string, string>,
): { gradientClass: string, value: string, colorClasses: string[] } | null {
  const linearDir = classes.find(c => LINEAR_GRADIENT_DIRECTIONS[c])
  const radialShape = classes.find(c => RADIAL_GRADIENT_SHAPES[c])
  const fromClass = classes.find(c => c.startsWith('from-'))
  const viaClass = classes.find(c => c.startsWith('via-'))
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

// ============================================================================
// Public API - Class resolution
// ============================================================================

/**
 * Resolve an array of Tailwind classes to their full CSS style declarations.
 * Returns a map of class -> { property: value } for all resolvable classes.
 */
export async function resolveClassesToStyles(
  classes: string[],
  options: Tw4ResolverOptions,
): Promise<Record<string, Record<string, string>>> {
  const { compiler, vars } = await getCompiler(options.cssPath, options.nuxtUiColors)

  const uncached = classes.filter(c => !resolvedStyleCache.has(c))

  if (uncached.length > 0) {
    const outputCss = compiler.build(uncached)
    const parsedClasses = parseCssOutput(outputCss, vars)

    for (const [className, rawStyles] of parsedClasses) {
      const styles: Record<string, string> = {}

      for (const [prop, rawValue] of Object.entries(rawStyles)) {
        let value = resolveVars(rawValue, vars)

        if (value.includes('var('))
          continue

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

    for (const c of uncached) {
      if (!resolvedStyleCache.has(c))
        resolvedStyleCache.set(c, null)
    }
  }

  const result: Record<string, Record<string, string>> = {}
  for (const cls of classes) {
    const resolved = resolvedStyleCache.get(cls)
    if (resolved)
      result[cls] = resolved
  }

  const gradient = buildGradient(classes, vars)
  if (gradient) {
    result[gradient.gradientClass] = { 'background-image': gradient.value }
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

// ============================================================================
// Public API - Style map generation
// ============================================================================

/**
 * Extract CSS variables from TW4 compiled output.
 */
function extractVars(css: string): Map<string, string> {
  const vars = new Map<string, string>()
  const root = postcss.parse(css)

  root.walkDecls((decl) => {
    if (decl.prop.startsWith('--')) {
      vars.set(decl.prop, decl.value)
    }
  })

  return vars
}

/**
 * Build CSS variable declarations from various sources.
 */
async function buildVarsCSS(vars: Map<string, string>, nuxtUiColors?: Record<string, string>): Promise<string> {
  if (nuxtUiColors)
    buildNuxtUiVars(vars, nuxtUiColors)

  const lines: string[] = [':root {']
  for (const [name, value] of vars) {
    lines.push(`  ${name}: ${value};`)
  }
  lines.push('}')
  return lines.join('\n')
}

/**
 * Parse CSS rules into a class → styles map.
 */
function parseClassStyles(css: string): Map<string, Record<string, string>> {
  const classMap = new Map<string, Record<string, string>>()
  const root = postcss.parse(css)

  root.walkRules((rule) => {
    const selector = rule.selector
    if (!selector.startsWith('.'))
      return

    const className = decodeCssClassName(selector)

    if (className.includes(':') && !className.match(/^[\w-]+$/))
      return
    if (className.includes(' ') || className.includes('>') || className.includes('+'))
      return

    const styles: Record<string, string> = classMap.get(className) || {}

    rule.walkDecls((decl) => {
      if (decl.prop.startsWith('--'))
        return

      const camelProp = decl.prop.replace(/-([a-z])/g, (_, l) => l.toUpperCase())
      // Sanitize Satori-incompatible values
      let value = decl.value
      // TW4 uses calc(infinity*1px) for rounded-full, Satori doesn't support this
      if (value.includes('calc(infinity'))
        value = '9999px'
      // Satori expects opacity as unitless decimal (0.6), not percentage (60%)
      if (decl.prop === 'opacity' && value.endsWith('%'))
        value = String(Number.parseFloat(value) / 100)
      styles[camelProp] = value
    })

    if (Object.keys(styles).length > 0) {
      classMap.set(className, styles)
    }
  })

  return classMap
}

/**
 * Generate a complete style map from TW4 classes.
 */
export async function generateStyleMap(options: GeneratorOptions): Promise<StyleMap> {
  const { cssPath, classes, nuxtUiColors } = options

  if (classes.length === 0) {
    return { classes: new Map(), vars: new Map() }
  }

  await loadTw4Deps()

  const cssContent = await readFile(cssPath, 'utf-8')
  const baseDir = dirname(cssPath)

  const compiler = await compile(cssContent, {
    base: baseDir,
    loadStylesheet: createStylesheetLoader(baseDir),
  })

  const rawCSS = compiler.build(classes)
  const vars = extractVars(rawCSS)
  const varsCSS = await buildVarsCSS(vars, nuxtUiColors)
  const fullCSS = `${varsCSS}\n${rawCSS}`

  const result = await postcss([
    postcssCustomProperties({
      preserve: false,
    }),
    postcssCalc({}),
  ]).process(fullCSS, { from: undefined })

  const resolvedCSS = result.css
  const hexCSS = convertOklchToHex(resolvedCSS)
  const classMap = parseClassStyles(hexCSS)

  return { classes: classMap, vars }
}

/**
 * Serialize style map for embedding in build output.
 */
export function serializeStyleMap(styleMap: StyleMap): string {
  const obj: Record<string, Record<string, string>> = {}
  for (const [cls, styles] of styleMap.classes) {
    obj[cls] = styles
  }
  return JSON.stringify(obj)
}
