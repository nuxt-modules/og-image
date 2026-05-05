import type { CssProvider } from '../css-provider'
import type { ExtractedCssVars } from '../css-utils'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolveModulePath } from 'exsolve'
import { dirname, join } from 'pathe'
import { extractVariantBaseClasses, resolveVariantPrefixes } from '../css-provider'
import {
  extractClassStyles,
  extractCssVars,
  extractPerClassVars,
  extractUniversalVars,
  extractVarsFromCss,
  loadLightningCss,
  postProcessStyles,
  resolveExtractedVars,
  resolveVarsDeep,
  simplifyCss,
} from '../css-utils'

const RE_GRADIENT_STOP_PREFIX = /^(from|via|to)-/
const RE_COLOR_SHADE = /^(.+)-(\d+)$/
const RE_CSS_COLOR_VALUE = /color:([^;}]+)/
const RE_TO_DIRECTION = /^to-(?:[tblr]|tl|tr|bl|br)$/
const RE_FONT_VAR = /--font-([\w-]+)\s*:/g

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
 * Create a module loader for the TW4 compiler.
 * Required for CSS that uses @plugin or @config directives (e.g., @nuxt/ui).
 */
export function createModuleLoader(baseDir: string) {
  return async (id: string, base: string) => {
    // Use suffixes + extensions to handle packages without an `exports` map
    // (e.g. daisyui/theme resolves to daisyui/theme/index.js)
    const resolved = resolveModulePath(id, {
      from: base || baseDir,
      try: true,
      suffixes: ['', '/index'],
      extensions: ['.js', '.mjs', '.cjs'],
    })
    if (resolved) {
      const module = await import(pathToFileURL(resolved).href).then(m => m.default || m)
      return { path: resolved, base: dirname(resolved), module }
    }
    // Fallback: try relative resolution
    const relativePath = join(base || baseDir, id)
    const module = await import(pathToFileURL(relativePath).href).then(m => m.default || m).catch(() => ({}))
    return { path: relativePath, base: dirname(relativePath), module }
  }
}

/**
 * Create a stylesheet loader for the TW4 compiler.
 */
export function createStylesheetLoader(baseDir: string) {
  return async (id: string, base: string) => {
    // Handle tailwindcss import
    if (id === 'tailwindcss') {
      const twPath = resolveModulePath('tailwindcss/index.css', { from: baseDir, try: true })
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
    const resolved = resolveModulePath(id, {
      from: base || baseDir,
      conditions: ['style'],
      try: true,
      suffixes: ['', '/index'],
      extensions: ['.css', '.js', '.mjs'],
    })
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
 *
 * If `theme` is provided ('light' | 'dark'), semantic bg/text/border variables
 * are populated for the requested theme.
 *
 * Default: legacy behavior — force-set dark-mode semantic values (preserves
 * backward compatibility with components that don't opt into theme-awareness).
 */
export function buildNuxtUiVars(
  vars: Map<string, string>,
  nuxtUiColors: Record<string, string>,
  theme?: 'light' | 'dark',
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

  const neutral = nuxtUiColors.neutral || 'slate'
  const neutralColors = colors[neutral]

  // Theme-aware semantic vars. When theme === 'light', emit light values; when 'dark', dark values.
  // When theme is undefined, fall back to legacy dark-mode forcing (existing OG image default).
  const semanticVars: Record<string, string> = theme === 'light'
    ? {
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
    : {
        // Dark mode (default for OG images, also explicit theme === 'dark')
        '--ui-text-dimmed': neutralColors?.[500] || '',
        '--ui-text-muted': neutralColors?.[400] || '',
        '--ui-text-toned': neutralColors?.[300] || '',
        '--ui-text': neutralColors?.[200] || '',
        '--ui-text-highlighted': '#ffffff',
        '--ui-text-inverted': neutralColors?.[900] || '',
        '--ui-bg': neutralColors?.[900] || '',
        '--ui-bg-muted': neutralColors?.[800] || '',
        '--ui-bg-elevated': neutralColors?.[800] || '',
        '--ui-bg-accented': neutralColors?.[700] || '',
        '--ui-bg-inverted': '#ffffff',
        '--ui-border': neutralColors?.[800] || '',
        '--ui-border-muted': neutralColors?.[700] || '',
        '--ui-border-accented': neutralColors?.[700] || '',
        '--ui-border-inverted': '#ffffff',
      }
  // Force-set semantic vars to override any conflicting CSS-extracted vars
  for (const [name, value] of Object.entries(semanticVars)) {
    if (value)
      vars.set(name, value)
  }
}

// ============================================================================
// Compiler cache and state
// ============================================================================

type TwCompiler = Awaited<ReturnType<typeof import('tailwindcss').compile>>
let cachedCompiler: TwCompiler | null = null
let cachedCssPath: string | null = null
let cachedVars: Map<string, string> | null = null
/** Theme-qualified vars extracted from compiled CSS (populated lazily as classes are built). */
let cachedExtractedVars: ExtractedCssVars | null = null
let pendingCompiler: Promise<{ compiler: TwCompiler, vars: Map<string, string> }> | null = null
const resolvedStyleCache = new Map<string, Record<string, string> | null>()

/** Clear user vars and style cache only (for HMR when CSS files change) */
export function clearTw4UserVarsCache() {
  cachedVars = null
  cachedExtractedVars = null
  resolvedStyleCache.clear()
}

/** Clear the full compiler cache (for HMR when config changes) */
export function clearTw4Cache() {
  cachedCompiler = null
  cachedCssPath = null
  cachedVars = null
  cachedExtractedVars = null
  pendingCompiler = null
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

async function getCompiler(cssPath: string, nuxtUiColors?: Record<string, string>): Promise<{ compiler: TwCompiler, vars: Map<string, string> }> {
  if (cachedCompiler && cachedCssPath === cssPath)
    return { compiler: cachedCompiler, vars: cachedVars! }

  // Deduplicate concurrent compilations — without this, clearing the cache
  // during HMR causes every OG component transform to independently recompile TW4
  if (pendingCompiler)
    return pendingCompiler

  pendingCompiler = (async () => {
    await loadTw4Deps()

    const userCss = await readFile(cssPath, 'utf-8')
    const baseDir = dirname(cssPath)

    const compiler = await compile(userCss, {
      loadStylesheet: createStylesheetLoader(baseDir),
      loadModule: createModuleLoader(baseDir),
    })

    const vars = new Map<string, string>()

    // Add Nuxt UI color fallbacks (legacy path: force-dark semantics)
    if (nuxtUiColors)
      buildNuxtUiVars(vars, nuxtUiColors)

    cachedCompiler = compiler
    cachedCssPath = cssPath
    cachedVars = vars
    cachedExtractedVars = {
      rootVars: new Map(),
      qualifiedRules: [],
      universalVars: new Map(),
      propertyInitials: new Map(),
      perClassVars: new Map(),
    }
    resolvedStyleCache.clear()

    return { compiler, vars }
  })()

  const p = pendingCompiler!
  p.finally(() => {
    pendingCompiler = null
  })
  return p
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
 * If `extractedAccum` is provided, also accumulates theme-qualified rules for theme-aware resolution.
 */
async function parseCssOutput(
  rawCss: string,
  vars: Map<string, string>,
  extractedAccum?: ExtractedCssVars,
): Promise<ParsedCssOutput> {
  const css = await simplifyCss(rawCss)

  // Extract :root/:host variables
  for (const [name, value] of extractCssVars(css)) {
    if (!vars.has(name))
      vars.set(name, value)
  }

  // Extract universal selector defaults (TW4 base-layer: *, ::before, ::after)
  for (const [name, value] of extractUniversalVars(css)) {
    if (!vars.has(name))
      vars.set(name, value)
  }

  // Extract per-class CSS variable overrides (e.g., .shadow-2xl { --tw-shadow: ... })
  const perClassVars = extractPerClassVars(css)

  // Theme-aware extraction: populate qualified-rule-aware vars cache
  if (extractedAccum) {
    const fresh = await extractVarsFromCss(css)
    for (const [n, v] of fresh.rootVars) {
      if (!extractedAccum.rootVars.has(n))
        extractedAccum.rootVars.set(n, v)
    }
    extractedAccum.qualifiedRules.push(...fresh.qualifiedRules)
    for (const [n, v] of fresh.universalVars) {
      if (!extractedAccum.universalVars.has(n))
        extractedAccum.universalVars.set(n, v)
    }
    for (const [n, v] of fresh.propertyInitials) {
      if (!extractedAccum.propertyInitials.has(n))
        extractedAccum.propertyInitials.set(n, v)
    }
    for (const [name, classVars] of fresh.perClassVars) {
      const existing = extractedAccum.perClassVars.get(name)
      if (existing) {
        for (const [k, v] of classVars) existing.set(k, v)
      }
      else {
        extractedAccum.perClassVars.set(name, new Map(classVars))
      }
    }
  }

  // Extract class styles (skip --tw-* and all CSS vars from style output)
  const classes = extractClassStyles(css, { skipPrefixes: ['--'], merge: true })

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
  const colorName = cls.replace(RE_GRADIENT_STOP_PREFIX, '')

  const shadeMatch = colorName.match(RE_COLOR_SHADE)
  if (shadeMatch?.[1] && shadeMatch?.[2]) {
    const varName = `--color-${shadeMatch[1]}-${shadeMatch[2]}`
    const value = vars.get(varName)
    if (value) {
      const resolved = await resolveVarsDeep(value, vars)
      if (!resolved.includes('var(')) {
        const simplified = await simplifyCss(`.x{color:${resolved}}`)
        return simplified.match(RE_CSS_COLOR_VALUE)?.[1]?.trim() ?? resolved
      }
    }
  }

  const varName = `--color-${colorName}`
  const value = vars.get(varName)
  if (value) {
    const resolved = await resolveVarsDeep(value, vars)
    if (!resolved.includes('var(')) {
      const simplified = await simplifyCss(`.x{color:${resolved}}`)
      return simplified.match(RE_CSS_COLOR_VALUE)?.[1]?.trim() ?? resolved
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
  const toClass = classes.find(c => c.startsWith('to-') && !RE_TO_DIRECTION.test(c))

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
 * Build a flat var Map for a given theme by overlaying nuxt-ui semantic vars
 * (theme-aware) and theme-qualified CSS extracted vars onto the legacy base vars.
 */
function buildThemeVars(
  baseVars: Map<string, string>,
  extracted: ExtractedCssVars | null,
  theme: 'light' | 'dark',
  nuxtUiColors?: Record<string, string>,
): Map<string, string> {
  // Start from a clone of baseVars stripped of legacy semantic overrides — those
  // are dark-only and would mask the theme we're building for.
  const vars = new Map(baseVars)

  // Re-apply nuxt-ui vars for the requested theme (overrides legacy dark-only)
  if (nuxtUiColors)
    buildNuxtUiVars(vars, nuxtUiColors, theme)

  if (extracted) {
    const themeRootAttrs: Record<string, string> = { 'data-theme': theme }
    const themeVars = resolveExtractedVars(extracted, themeRootAttrs)
    for (const [n, v] of themeVars)
      vars.set(n, v)
  }
  return vars
}

/**
 * Resolve an array of Tailwind classes to their full CSS style declarations.
 * Returns a map of class -> { property: value } for all resolvable classes.
 *
 * When `theme` is provided, resolution uses theme-aware vars (semantic Nuxt UI
 * tokens swap based on theme). Otherwise legacy force-dark behavior is used.
 */
export async function resolveClassesToStyles(
  classes: string[],
  options: Tw4ResolverOptions,
  context?: string,
  theme?: 'light' | 'dark',
): Promise<Record<string, Record<string, string>>> {
  const { compiler, vars } = await getCompiler(options.cssPath, options.nuxtUiColors)

  // Cache key includes theme so light/dark resolve independently
  const cacheKeyFor = (cls: string) => theme ? `${cls}|${theme}` : cls

  const uncached = classes.filter(c => !resolvedStyleCache.has(cacheKeyFor(c)))

  if (uncached.length > 0) {
    const outputCss = compiler.build(uncached)
    // Always populate cachedExtractedVars so theme switches stay correct
    const { classes: parsedClasses, perClassVars } = await parseCssOutput(outputCss, vars, cachedExtractedVars || undefined)

    const resolveVarsForClass = theme
      ? buildThemeVars(vars, cachedExtractedVars, theme, options.nuxtUiColors)
      : vars

    for (const [className, rawStyles] of parsedClasses) {
      // Merge global vars with per-class var overrides for resolution
      const classVars = perClassVars.get(className)
      const mergedVars = classVars ? new Map([...resolveVarsForClass, ...classVars]) : resolveVarsForClass
      const styles = await postProcessStyles(rawStyles, mergedVars, undefined, context)
      const cacheKey = cacheKeyFor(className)
      // Gradients must resolve to something for buildGradient to find them later
      if (!styles && className.startsWith('bg-gradient-')) {
        resolvedStyleCache.set(cacheKey, rawStyles)
      }
      else {
        resolvedStyleCache.set(cacheKey, styles)
      }
    }

    for (const c of uncached) {
      const key = cacheKeyFor(c)
      if (!resolvedStyleCache.has(key))
        resolvedStyleCache.set(key, null)
    }
  }

  const result: Record<string, Record<string, string>> = {}
  for (const cls of classes) {
    const resolved = resolvedStyleCache.get(cacheKeyFor(cls))
    if (resolved)
      result[cls] = resolved
  }

  const gradientVars = theme
    ? buildThemeVars(vars, cachedExtractedVars, theme, options.nuxtUiColors)
    : vars
  const gradient = await buildGradient(classes, gradientVars)
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

  // TW4 tree-shakes @theme vars not referenced by utility classes.
  // Extract --font-* names from the raw CSS and pass corresponding
  // font-* class candidates so the compiler emits them.
  const userCss = await readFile(options.cssPath, 'utf-8')
  const fontCandidates = Array.from(userCss.matchAll(RE_FONT_VAR), m => `font-${m[1]}`)
  const themeCss = compiler.build(fontCandidates)
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
      const shadeMatch = colorPath.match(RE_COLOR_SHADE)

      const simplified = await simplifyCss(`.x{color:${resolvedValue}}`)
      const hexValue = simplified.match(RE_CSS_COLOR_VALUE)?.[1]?.trim() ?? resolvedValue

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

    async resolveClassesToStyles(classes: string[], context?: string, rootAttrs?: Record<string, string>): Promise<Record<string, Record<string, string> | string>> {
      await init()
      if (!cssPath)
        return {}

      // Extract base classes from prefixed variants (e.g., lg:bg-black → bg-black)
      const baseClasses = extractVariantBaseClasses(classes)
      const classesToResolve = [...new Set([...classes, ...baseClasses])]

      const nuxtUiColors = await options.loadNuxtUiColors()
      // Theme opt-in: only when rootAttrs has explicit data-theme. Otherwise legacy force-dark.
      const theme = rootAttrs?.['data-theme'] === 'light' || rootAttrs?.['data-theme'] === 'dark'
        ? rootAttrs['data-theme']
        : undefined
      const tw4Resolved = await resolveClassesToStyles(classesToResolve, {
        cssPath,
        nuxtUiColors,
      }, context, theme)

      // Convert to Map for shared variant resolution
      const resolvedMap = new Map(Object.entries(tw4Resolved))

      // Apply variant-prefix-aware resolution (shared with UnoCSS provider)
      return resolveVariantPrefixes(classes, resolvedMap)
    },

    async extractMetadata() {
      await init()
      if (!cssPath)
        return { fontVars: {}, breakpoints: {}, colors: {} }
      const nuxtUiColors = await options.loadNuxtUiColors()
      return extractTw4Metadata({ cssPath, nuxtUiColors })
    },

    async getVars(rootAttrs?: Record<string, string>) {
      await init()
      if (!cssPath)
        return new Map()
      const nuxtUiColors = await options.loadNuxtUiColors()
      const { vars } = await getCompiler(cssPath, nuxtUiColors)
      const theme = rootAttrs?.['data-theme'] === 'light' || rootAttrs?.['data-theme'] === 'dark'
        ? rootAttrs['data-theme']
        : undefined
      if (!theme)
        return vars
      return buildThemeVars(vars, cachedExtractedVars, theme, nuxtUiColors)
    },

    clearUserVarsCache: clearTw4UserVarsCache,
    clearCache: clearTw4Cache,
  }
}
