import { readFile } from 'node:fs/promises'
import { resolveModulePath } from 'exsolve'
import { dirname, join } from 'pathe'
import twColors from 'tailwindcss/colors'
import {
  COLOR_PROPERTIES,
  convertColorToHex,
  convertOklchToHex,
  decodeCssClassName,
  extractClassStyles,
  extractCssVars,
  isSimpleClassSelector,
  loadLightningCss,
  resolveCssVars,
  simplifyCss,
} from '../css-utils'

// Lazy-loaded heavy dependencies
let compile: typeof import('tailwindcss').compile

async function loadTw4Deps() {
  if (!compile) {
    const [, tailwindModule] = await Promise.all([
      loadLightningCss(),
      import('tailwindcss'),
    ])
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

  // Add Nuxt UI semantic text/bg/border variables (dark mode for OG images)
  const neutral = nuxtUiColors.neutral || 'slate'
  const neutralColors = colors[neutral]
  const semanticVars: Record<string, string> = {
    // Dark mode text colors (inverted from light mode)
    '--ui-text-dimmed': neutralColors?.[500] || '',
    '--ui-text-muted': neutralColors?.[400] || '',
    '--ui-text-toned': neutralColors?.[300] || '',
    '--ui-text': neutralColors?.[200] || '',
    '--ui-text-highlighted': '#ffffff',
    '--ui-text-inverted': neutralColors?.[900] || '',
    // Dark mode backgrounds
    '--ui-bg': neutralColors?.[900] || '',
    '--ui-bg-muted': neutralColors?.[800] || '',
    '--ui-bg-elevated': neutralColors?.[800] || '',
    '--ui-bg-accented': neutralColors?.[700] || '',
    '--ui-bg-inverted': '#ffffff',
    // Dark mode borders
    '--ui-border': neutralColors?.[800] || '',
    '--ui-border-muted': neutralColors?.[700] || '',
    '--ui-border-accented': neutralColors?.[700] || '',
    '--ui-border-inverted': '#ffffff',
  }
  // Force-set semantic vars to ensure dark mode (override any light mode vars from CSS)
  for (const [name, value] of Object.entries(semanticVars)) {
    if (value)
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
 * Parse TW4 compiler output.
 * Extracts CSS variables and class styles.
 */
function parseCssOutput(css: string, vars: Map<string, string>): Map<string, Record<string, string>> {
  // Extract :root/:host variables
  const cssVars = extractCssVars(css)
  for (const [name, value] of cssVars) {
    if (!vars.has(name))
      vars.set(name, value)
  }

  // Extract class styles (no ^ anchor - rules may be inside @layer blocks)
  const classes = new Map<string, Record<string, string>>()
  const ruleRe = /\.((?:\\[0-9a-f]+\s?|\\.|[^\s{])+)\s*\{([^}]+)\}/gi

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
      // Skip internal TW CSS variables
      if (prop.startsWith('--tw-'))
        continue
      // Skip all CSS variables for now
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
 * Evaluate calc() expressions using Lightning CSS.
 */
async function evaluateCalc(value: string): Promise<string> {
  if (!value.includes('calc('))
    return value

  const fakeCss = `.x{v:${value}}`
  const result = await simplifyCss(fakeCss)
  const match = result.match(/\.x\s*\{\s*v:\s*([^;]+);?\s*\}/)
  return match?.[1]?.trim() ?? value
}

/**
 * Resolve var() references in a value string.
 */
async function resolveVars(value: string, vars: Map<string, string>, depth = 0): Promise<string> {
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

  // Resolve var() references
  let result = resolveCssVars(value, vars)

  // If still has var(), recurse
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

async function resolveGradientColor(cls: string, vars: Map<string, string>): Promise<string | null> {
  const colorName = cls.replace(/^(from|via|to)-/, '')

  const shadeMatch = colorName.match(/^(.+)-(\d+)$/)
  if (shadeMatch?.[1] && shadeMatch?.[2]) {
    const varName = `--color-${shadeMatch[1]}-${shadeMatch[2]}`
    const value = vars.get(varName)
    if (value) {
      const resolved = await resolveVars(value, vars)
      if (!resolved.includes('var('))
        return convertColorToHex(resolved)
    }
  }

  const varName = `--color-${colorName}`
  const value = vars.get(varName)
  if (value) {
    const resolved = await resolveVars(value, vars)
    if (!resolved.includes('var('))
      return convertColorToHex(resolved)
  }

  return null
}

async function buildGradient(
  classes: string[],
  vars: Map<string, string>,
): Promise<{ gradientClass: string, value: string, colorClasses: string[] } | null> {
  const linearDir = classes.find(c => LINEAR_GRADIENT_DIRECTIONS[c])
  const radialShape = classes.find(c => RADIAL_GRADIENT_SHAPES[c])
  const fromClass = classes.find(c => c.startsWith('from-'))
  const viaClass = classes.find(c => c.startsWith('via-'))
  const toClass = classes.find(c => c.startsWith('to-') && !/^to-(?:[tblr]|tl|tr|bl|br)$/.test(c))

  if (!linearDir && !radialShape)
    return null
  if (!fromClass && !toClass)
    return null

  const fromColor = fromClass ? await resolveGradientColor(fromClass, vars) : null
  const viaColor = viaClass ? await resolveGradientColor(viaClass, vars) : null
  const toColor = toClass ? await resolveGradientColor(toClass, vars) : null

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
        let value = await resolveVars(rawValue, vars)

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

  const gradient = await buildGradient(classes, vars)
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
    const resolvedValue = await resolveVars(value, vars)

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
 * Build CSS variable declarations from various sources.
 */
function buildVarsCSS(vars: Map<string, string>, nuxtUiColors?: Record<string, string>): string {
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
 * Parse CSS rules into a class → styles map with camelCase properties.
 * Handles TW4-specific values that need normalization for renderers.
 */
function parseClassStylesCamelCase(css: string): Map<string, Record<string, string>> {
  const classMap = new Map<string, Record<string, string>>()
  // Note: No ^ anchor - rules may be inside @layer blocks and indented
  const ruleRe = /\.((?:\\[0-9a-f]+\s?|\\.|[^\s{])+)\s*\{([^}]+)\}/gi

  for (const match of css.matchAll(ruleRe)) {
    const rawSelector = match[1]!
    const body = match[2]!

    if (!isSimpleClassSelector(rawSelector))
      continue

    const className = decodeCssClassName(rawSelector)
    const styles: Record<string, string> = classMap.get(className) || {}

    const declRe = /([\w-]+)\s*:\s*([^;]+);/g
    for (const declMatch of body.matchAll(declRe)) {
      const prop = declMatch[1]!
      let value = declMatch[2]!.trim()

      if (prop.startsWith('--'))
        continue

      // Convert to camelCase for style objects
      const camelProp = prop.replace(/-([a-z])/g, (_, l) => l.toUpperCase())

      // Normalize TW4-specific values:
      // TW4 uses calc(infinity*1px) for rounded-full - convert to standard large value
      if (value.includes('calc(infinity'))
        value = '9999px'

      // Normalize opacity percentage to decimal (CSS standard is unitless 0-1)
      if (prop === 'opacity' && value.endsWith('%'))
        value = String(Number.parseFloat(value) / 100)

      styles[camelProp] = value
    }

    if (Object.keys(styles).length > 0)
      classMap.set(className, styles)
  }

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
  const vars = extractCssVars(rawCSS)
  const varsCSS = buildVarsCSS(vars, nuxtUiColors)
  const fullCSS = `${varsCSS}\n${rawCSS}`

  // Step 1: Resolve CSS variables
  const resolvedCSS = resolveCssVars(fullCSS, vars)

  // Step 2: Simplify calc() with Lightning CSS
  const simplifiedCSS = await simplifyCss(resolvedCSS)

  // Step 3: Convert oklch to hex
  const hexCSS = convertOklchToHex(simplifiedCSS)

  // Step 4: Parse into class map
  const classMap = parseClassStylesCamelCase(hexCSS)

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
