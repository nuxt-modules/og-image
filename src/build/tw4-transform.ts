import { readFile } from 'node:fs/promises'
import { formatHex, parse, toGamut } from 'culori'
import { dirname, join } from 'pathe'
import postcss from 'postcss'

export type Tw4FontVars = Record<string, string>
export type Tw4Breakpoints = Record<string, number>
export type Tw4Colors = Record<string, string | Record<string, string>>

export interface Tw4Metadata {
  fontVars: Tw4FontVars
  breakpoints: Tw4Breakpoints
  colors: Tw4Colors
}

// Gamut map oklch to sRGB using culori's toGamut (reduces chroma to fit gamut)
const toSrgbGamut = toGamut('rgb', 'oklch')

// Convert any CSS color to hex with proper gamut mapping for oklch
function convertColorToHex(value: string): string {
  if (value.includes('var('))
    return value
  const color = parse(value)
  if (!color)
    return value
  const mapped = toSrgbGamut(color)
  const hex = formatHex(mapped)
  return hex || value
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
  const twColors = await import('tailwindcss/colors').then(m => m.default) as Record<string, Record<number, string>>

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

  // Add Nuxt UI color fallbacks (generated at runtime, not in static CSS)
  if (nuxtUiColors) {
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
    for (const [semantic, twColor] of Object.entries(nuxtUiColors)) {
      for (const shade of shades) {
        const varName = `--ui-color-${semantic}-${shade}`
        const value = twColors[twColor]?.[shade]
        if (value && !vars.has(varName))
          vars.set(varName, value)
      }
      if (!vars.has(`--ui-${semantic}`))
        vars.set(`--ui-${semantic}`, twColors[twColor]?.[500] || '')
    }

    // Add Nuxt UI semantic text/bg/border variables (light mode defaults)
    const neutral = nuxtUiColors.neutral || 'slate'
    const semanticVars: Record<string, string> = {
      '--ui-text-dimmed': twColors[neutral]?.[400] || '',
      '--ui-text-muted': twColors[neutral]?.[500] || '',
      '--ui-text-toned': twColors[neutral]?.[600] || '',
      '--ui-text': twColors[neutral]?.[700] || '',
      '--ui-text-highlighted': twColors[neutral]?.[900] || '',
      '--ui-text-inverted': '#ffffff',
      '--ui-bg': '#ffffff',
      '--ui-bg-muted': twColors[neutral]?.[50] || '',
      '--ui-bg-elevated': twColors[neutral]?.[100] || '',
      '--ui-bg-accented': twColors[neutral]?.[200] || '',
      '--ui-bg-inverted': twColors[neutral]?.[900] || '',
      '--ui-border': twColors[neutral]?.[200] || '',
      '--ui-border-muted': twColors[neutral]?.[200] || '',
      '--ui-border-accented': twColors[neutral]?.[300] || '',
      '--ui-border-inverted': twColors[neutral]?.[900] || '',
    }
    for (const [name, value] of Object.entries(semanticVars)) {
      if (value && !vars.has(name))
        vars.set(name, value)
    }
  }

  cachedCompiler = compiler
  cachedCssPath = cssPath
  cachedVars = vars
  resolvedStyleCache.clear()

  return { compiler, vars }
}

// CSS properties that contain colors (need oklch→hex conversion)
const COLOR_PROPERTIES = new Set([
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

    // Handle escaped characters in class names (e.g., .\32xl -> 2xl)
    let className = sel.slice(1)
    if (className.startsWith('\\'))
      className = className.replace(/\\([0-9a-f]+)\s?/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))

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
 * Resolve var() references in a value string.
 * Handles nested vars and calc() expressions.
 */
function resolveVars(value: string, vars: Map<string, string>, depth = 0): string {
  if (depth > 10 || !value.includes('var('))
    return value

  // Handle calc(var(--name) * N) pattern
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

  // Replace all var() references iteratively
  let result = value
  const varPattern = /var\((--[\w-]+)(?:,\s*([^)]+))?\)/g
  let match
  let iterations = 0

  while ((match = varPattern.exec(result)) !== null && iterations < 20) {
    const [fullMatch, varName, fallback] = match
    if (!varName)
      continue
    const resolved = vars.get(varName) ?? fallback
    if (resolved) {
      result = result.replace(fullMatch, resolved)
      varPattern.lastIndex = 0 // Reset to catch nested vars
    }
    iterations++
  }

  return result.includes('var(') ? result : resolveVars(result, vars, depth + 1)
}

/**
 * Convert oklch colors in gradient values to hex.
 */
function convertGradientColors(value: string): string {
  // Match oklch(...) or color function calls within gradients
  return value.replace(/oklch\([^)]+\)/g, (match) => {
    const hex = convertColorToHex(match)
    return hex.startsWith('#') ? hex : match
  })
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
