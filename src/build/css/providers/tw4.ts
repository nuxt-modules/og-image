import type { CssProvider } from '../css-provider'
import { readFile } from 'node:fs/promises'
import { resolveModulePath } from 'exsolve'
import { dirname, join } from 'pathe'
import {
  extractClassStyles,
  extractCssVars,
  extractPerClassVars,
  extractUniversalVars,
  loadLightningCss,
  postProcessStyles,
  resolveVarsDeep,
  simplifyCss,
} from '../css-utils'

// Lazy-loaded heavy dependencies
let compile: typeof import('tailwindcss').compile
let twColors: Record<string, Record<number, string>>

async function loadTw4Deps() {
  if (!compile) {
    const [, tailwindModule, colorsModule] = await Promise.all([
      loadLightningCss(),
      import('tailwindcss'),
      import('tailwindcss/colors'),
    ])
    compile = tailwindModule.compile
    twColors = (colorsModule.default || colorsModule) as any
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
  const colors = twColors
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

interface ParsedCssOutput {
  classes: Map<string, Record<string, string>>
  perClassVars: Map<string, Map<string, string>>
}

/**
 * Parse TW4 compiler output.
 * Extracts CSS variables into vars Map and returns class styles + per-class vars.
 */
async function parseCssOutput(rawCss: string, vars: Map<string, string>): Promise<ParsedCssOutput> {
  const css = await simplifyCss(rawCss)

  // Extract :root/:host variables
  for (const [name, value] of extractCssVars(css)) {
    if (!vars.has(name))
      vars.set(name, value)
  }

  // Extract universal selector defaults (TW4 base-layer: *, ::before, ::after)
  // These provide default values for --tw-shadow, --tw-ring-shadow, etc.
  for (const [name, value] of extractUniversalVars(css)) {
    if (!vars.has(name))
      vars.set(name, value)
  }

  // Extract per-class CSS variable overrides (e.g., .shadow-2xl { --tw-shadow: ... })
  const perClassVars = extractPerClassVars(css)

  // Extract class styles (skip --tw-* and all CSS vars from style output)
  const classes = extractClassStyles(css, { skipPrefixes: ['--'] })

  return { classes, perClassVars }
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
      const resolved = await resolveVarsDeep(value, vars)
      if (!resolved.includes('var(')) {
        const simplified = await simplifyCss(`.x{color:${resolved}}`)
        return simplified.match(/color:([^;}]+)/)?.[1]?.trim() ?? resolved
      }
    }
  }

  const varName = `--color-${colorName}`
  const value = vars.get(varName)
  if (value) {
    const resolved = await resolveVarsDeep(value, vars)
    if (!resolved.includes('var(')) {
      const simplified = await simplifyCss(`.x{color:${resolved}}`)
      return simplified.match(/color:([^;}]+)/)?.[1]?.trim() ?? resolved
    }
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
    const { classes: parsedClasses, perClassVars } = await parseCssOutput(outputCss, vars)

    for (const [className, rawStyles] of parsedClasses) {
      // Merge global vars with per-class var overrides for resolution
      const classVars = perClassVars.get(className)
      const mergedVars = classVars ? new Map([...vars, ...classVars]) : vars
      const styles = await postProcessStyles(rawStyles, mergedVars)
      // Gradients must resolve to something for buildGradient to find them later
      if (!styles && className.startsWith('bg-gradient-')) {
        resolvedStyleCache.set(className, rawStyles)
      }
      else {
        resolvedStyleCache.set(className, styles)
      }
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
  await parseCssOutput(themeCss, vars)

  const fontVars: Tw4FontVars = {}
  const breakpoints: Tw4Breakpoints = {}
  const colors: Tw4Colors = {}

  for (const [name, value] of vars) {
    const resolvedValue = await resolveVarsDeep(value, vars)

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

      const simplified = await simplifyCss(`.x{color:${resolvedValue}}`)
      const hexValue = simplified.match(/color:([^;}]+)/)?.[1]?.trim() ?? resolvedValue

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
// Arbitrary class rewriting (TW-specific)
// ============================================================================

// Map CSS property → TW utility prefix for arbitrary value rewriting
const CSS_PROP_TO_TW_PREFIX: Record<string, string> = {
  'background-color': 'bg',
  'color': 'text',
  'border-color': 'border',
  'font-size': 'text',
  'font-weight': 'font',
  'line-height': 'leading',
  'letter-spacing': 'tracking',
  'opacity': 'opacity',
  'width': 'w',
  'height': 'h',
  'max-width': 'max-w',
  'max-height': 'max-h',
  'min-width': 'min-w',
  'min-height': 'min-h',
  'border-radius': 'rounded',
  'gap': 'gap',
}

/**
 * Convert a single-property resolved style back to a TW arbitrary value class.
 * Returns undefined for multi-property classes or unmapped properties.
 */
function stylesToArbitraryClass(styles: Record<string, string>): string | undefined {
  const entries = Object.entries(styles)
  if (entries.length !== 1)
    return undefined
  const [prop, value] = entries[0]!
  const prefix = CSS_PROP_TO_TW_PREFIX[prop]
  if (!prefix)
    return undefined
  return `${prefix}-[${value}]`
}

// ============================================================================
// CssProvider factory
// ============================================================================

export interface Tw4ProviderOptions {
  /** Resolve the Tailwind CSS entry file path */
  resolveCssPath: () => Promise<string | undefined>
  /** Load Nuxt UI semantic color mappings (if @nuxt/ui is installed) */
  loadNuxtUiColors: () => Promise<Record<string, string> | undefined>
}

/**
 * Create a TW4 CssProvider that implements the unified CssProvider interface.
 * Owns CSS path resolution, lazy initialization, and responsive prefix handling.
 */
export function createTw4Provider(options: Tw4ProviderOptions): CssProvider {
  let cssPath: string | undefined
  let initPromise: Promise<void> | undefined
  let initialized = false

  async function init() {
    if (initialized)
      return
    if (initPromise)
      return initPromise
    initPromise = (async () => {
      cssPath = await options.resolveCssPath()
      if (!cssPath) {
        initialized = true
        return
      }
      const content = await readFile(cssPath, 'utf-8')
      if (!content.includes('@theme') && !content.includes('@import "tailwindcss"'))
        cssPath = undefined
      initialized = true
    })()
    return initPromise
  }

  return {
    name: 'tailwind',

    async resolveClassesToStyles(classes: string[]): Promise<Record<string, Record<string, string> | string>> {
      await init()
      if (!cssPath)
        return {}

      // Extract base classes from prefixed variants (e.g., lg:bg-black → bg-black)
      const baseClasses = new Set<string>()
      for (const cls of classes) {
        const m = cls.match(/^(?:sm|md|lg|xl|2xl|dark):(.+)/)
        if (m?.[1])
          baseClasses.add(m[1])
      }
      const classesToResolve = [...new Set([...classes, ...baseClasses])]

      const nuxtUiColors = await options.loadNuxtUiColors()
      const tw4Resolved = await resolveClassesToStyles(classesToResolve, {
        cssPath,
        nuxtUiColors,
      })

      const resolved: Record<string, Record<string, string> | string> = {}

      // Collect CSS properties overridden by prefixed variants (dark:, sm:, etc.)
      // Base classes that conflict must stay as classes for runtime resolution
      const prefixOverrideProps = new Set<string>()
      for (const cls of classes) {
        const prefixMatch = cls.match(/^(?:sm|md|lg|xl|2xl|dark):(.+)/)
        if (prefixMatch) {
          const baseStyles = tw4Resolved[prefixMatch[1]!]
          if (baseStyles) {
            for (const prop of Object.keys(baseStyles))
              prefixOverrideProps.add(prop)
          }
        }
      }

      for (const cls of classes) {
        // Responsive/dark prefixed classes: resolve value but keep as class
        const prefixMatch = cls.match(/^((?:sm|md|lg|xl|2xl|dark):)(.+)/)
        if (prefixMatch) {
          const [, prefix, baseClass] = prefixMatch
          const baseStyles = tw4Resolved[baseClass!]
          if (baseStyles) {
            const arbitrary = stylesToArbitraryClass(baseStyles)
            resolved[cls] = arbitrary ? `${prefix}${arbitrary}` : cls
          }
          continue
        }

        if (tw4Resolved[cls]) {
          const styles = tw4Resolved[cls]
          // If a prefixed variant overrides any of this class's properties,
          // keep as class rewrite so runtime can resolve the conflict
          const hasConflict = Object.keys(styles).some(prop => prefixOverrideProps.has(prop))
          if (hasConflict) {
            const arbitrary = stylesToArbitraryClass(styles)
            resolved[cls] = arbitrary || cls
          }
          else {
            resolved[cls] = styles
          }
        }
        // Classes not in map will be kept in class attr for Satori's tw prop
      }
      return resolved
    },

    async extractMetadata() {
      await init()
      if (!cssPath)
        return { fontVars: {}, breakpoints: {}, colors: {} }
      const nuxtUiColors = await options.loadNuxtUiColors()
      return extractTw4Metadata({ cssPath, nuxtUiColors })
    },

    clearCache: clearTw4Cache,
  }
}
