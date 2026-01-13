import { readFile } from 'node:fs/promises'
import { formatHex, parse, toGamut } from 'culori'
import { dirname, join } from 'pathe'

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
  // Resolve var() first - return as-is if unresolved
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

// Resolved class cache (class -> arbitrary value or null if not color)
const resolvedClassCache = new Map<string, string | null>()

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

  // Variables will be extracted from each build output (not from a probe)
  // This ensures we get all vars referenced by the actual classes being resolved
  const vars = new Map<string, string>()

  // Add Nuxt UI color fallbacks (these are generated at runtime, not in static CSS)
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
    // These reference --ui-color-neutral-* which we set above
    const neutral = nuxtUiColors.neutral || 'slate'
    const semanticVars: Record<string, string> = {
      // Text variants
      '--ui-text-dimmed': twColors[neutral]?.[400] || '',
      '--ui-text-muted': twColors[neutral]?.[500] || '',
      '--ui-text-toned': twColors[neutral]?.[600] || '',
      '--ui-text': twColors[neutral]?.[700] || '',
      '--ui-text-highlighted': twColors[neutral]?.[900] || '',
      '--ui-text-inverted': '#ffffff',
      // Background variants
      '--ui-bg': '#ffffff',
      '--ui-bg-muted': twColors[neutral]?.[50] || '',
      '--ui-bg-elevated': twColors[neutral]?.[100] || '',
      '--ui-bg-accented': twColors[neutral]?.[200] || '',
      '--ui-bg-inverted': twColors[neutral]?.[900] || '',
      // Border variants
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

  // Resolve var() references
  for (const [name, value] of vars) {
    if (value.startsWith('var(')) {
      const refMatch = value.match(/var\((--[\w-]+)\)/)
      if (refMatch?.[1]) {
        const resolved = vars.get(refMatch[1])
        if (resolved && !resolved.startsWith('var('))
          vars.set(name, resolved)
      }
    }
  }

  cachedCompiler = compiler
  cachedCssPath = cssPath
  cachedVars = vars
  resolvedClassCache.clear()

  return { compiler, vars }
}

function resolveVarChain(value: string, vars: Map<string, string>, depth = 0): string {
  if (depth > 10 || !value.includes('var('))
    return value

  // Handle calc(var(--name) * N) pattern
  const calcMatch = value.match(/calc\(var\((--[\w-]+)\)\s*\*\s*([\d.]+)\)/)
  if (calcMatch?.[1] && calcMatch[2]) {
    const varValue = vars.get(calcMatch[1])
    if (varValue) {
      const numMatch = varValue.match(/([\d.]+)(rem|px|em|%)/)
      if (numMatch) {
        const computed = Number.parseFloat(numMatch[1]) * Number.parseFloat(calcMatch[2])
        return `${computed}${numMatch[2]}`
      }
    }
  }

  // Handle simple var(--name) pattern
  const varMatch = value.match(/var\((--[\w-]+)\)/)
  if (!varMatch?.[1])
    return value

  const resolved = vars.get(varMatch[1])
  if (resolved) {
    // Replace just this var() and continue resolving
    const newValue = value.replace(`var(${varMatch[1]})`, resolved)
    return resolveVarChain(newValue, vars, depth + 1)
  }
  return value
}

/**
 * Resolve an array of Tailwind classes to their arbitrary value equivalents.
 * Only returns mappings for classes that resolve to colors.
 * Results are cached per-session.
 */
export async function resolveClasses(
  classes: string[],
  options: Tw4ResolverOptions,
): Promise<Record<string, string>> {
  const { compiler, vars } = await getCompiler(options.cssPath, options.nuxtUiColors)

  // Filter to uncached classes
  const uncached = classes.filter(c => !resolvedClassCache.has(c))

  if (uncached.length > 0) {
    // Build only the classes we need
    const outputCss = compiler.build(uncached)

    // Extract :root/:host variables from this build output
    const rootMatches = outputCss.match(/:root[^{]*\{([^}]+)\}/g)
    if (rootMatches) {
      for (const block of rootMatches) {
        const contentMatch = block.match(/\{([^}]+)\}/)
        if (contentMatch?.[1]) {
          const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g
          let m
          while ((m = varRegex.exec(contentMatch[1])) !== null) {
            if (m[1] && !vars.has(`--${m[1]}`))
              vars.set(`--${m[1]}`, m[2]?.trim() || '')
          }
        }
      }
    }

    // Parse output CSS to extract resolved values
    // Handles: .text-muted { color: oklch(...) }
    const classRegex = /\.([\w-]+)\s*\{\s*([^}]+)\}/g
    let match
    while ((match = classRegex.exec(outputCss)) !== null) {
      const className = match[1]
      const props = match[2]
      if (!className || !props)
        continue

      // Look for color-related properties (including gradients and rings)
      const propMatch = props.match(/(background-color|color|border-color|fill|stroke|outline-color|--tw-ring-color|--tw-shadow-color|--tw-gradient-from|--tw-gradient-to|--tw-gradient-via):\s*([^;]+);/)
      if (propMatch?.[2]) {
        let value = propMatch[2].trim()
        // Resolve any var() references
        value = resolveVarChain(value, vars)

        if (!value.includes('var(')) {
          const hex = convertColorToHex(value)
          if (hex.startsWith('#')) {
            // Determine prefix from class name
            const prefix = className.match(/^(bg|text|border|ring|fill|stroke|outline|shadow|from|via|to|divide|decoration|accent|caret)-/)?.[1]
            if (prefix) {
              resolvedClassCache.set(className, `${prefix}-[${hex}]`)
              continue
            }
          }
        }
      }
      // Not a resolvable color class
      resolvedClassCache.set(className, null)
    }

    // Mark any classes that didn't produce output as unresolvable
    for (const c of uncached) {
      if (!resolvedClassCache.has(c))
        resolvedClassCache.set(c, null)
    }
  }

  // Build result map with only resolved classes
  const result: Record<string, string> = {}
  for (const cls of classes) {
    const resolved = resolvedClassCache.get(cls)
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
  const { vars } = await getCompiler(options.cssPath, options.nuxtUiColors)

  const fontVars: Tw4FontVars = {}
  const breakpoints: Tw4Breakpoints = {}
  const colors: Tw4Colors = {}

  for (const [name, value] of vars) {
    const resolvedValue = resolveVarChain(value, vars)

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

// Cache for full style resolution (class -> style object)
const resolvedStyleCache = new Map<string, Record<string, string> | null>()

// CSS properties that contain colors (need oklch→hex conversion)
const COLOR_PROPERTIES = new Set([
  'color',
  'background-color',
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
 * Resolve an array of Tailwind classes to their full CSS style declarations.
 * Returns a map of class -> { property: value } for all resolvable classes.
 */
export async function resolveClassesToStyles(
  classes: string[],
  options: Tw4ResolverOptions,
): Promise<Record<string, Record<string, string>>> {
  const { compiler, vars } = await getCompiler(options.cssPath, options.nuxtUiColors)

  // Detect and handle gradient class combinations
  const linearGradientDir = classes.find(c => c.startsWith('bg-gradient-to-'))
  const radialGradientShape = classes.find(c => c.startsWith('bg-radial'))
  const fromClass = classes.find(c => c.startsWith('from-'))
  const viaClass = classes.find(c => c.startsWith('via-'))
  // to-* for colors, but NOT to-t/b/l/r/tl/tr/bl/br (inset positions)
  const toClass = classes.find(c => c.startsWith('to-') && !/^to-([tblr]|tl|tr|bl|br)$/.test(c))

  // Filter to uncached classes
  const uncached = classes.filter(c => !resolvedStyleCache.has(c))

  if (uncached.length > 0) {
    const outputCss = compiler.build(uncached)

    // Extract :root/:host variables from build output
    const rootMatches = outputCss.match(/:root[^{]*\{([^}]+)\}/g)
    if (rootMatches) {
      for (const block of rootMatches) {
        const contentMatch = block.match(/\{([^}]+)\}/)
        if (contentMatch?.[1]) {
          const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g
          let m
          while ((m = varRegex.exec(contentMatch[1])) !== null) {
            if (m[1] && !vars.has(`--${m[1]}`))
              vars.set(`--${m[1]}`, m[2]?.trim() || '')
          }
        }
      }
    }

    // Parse output CSS to extract ALL style declarations per class
    // Match: .classname { prop: value; prop2: value2; }
    const classRegex = /\.([\w-]+)\s*\{\s*([^}]+)\}/g
    let match
    while ((match = classRegex.exec(outputCss)) !== null) {
      const className = match[1]
      const propsBlock = match[2]
      if (!className || !propsBlock)
        continue

      // Skip internal TW variables and pseudo-classes
      if (className.startsWith('\\') || className.includes(':'))
        continue

      const styles: Record<string, string> = {}

      // Parse each property declaration
      const propRegex = /([\w-]+)\s*:\s*([^;]+);/g
      let propMatch
      while ((propMatch = propRegex.exec(propsBlock)) !== null) {
        const prop = propMatch[1]?.trim()
        let value = propMatch[2]?.trim()
        if (!prop || !value)
          continue

        // Skip internal TW CSS variables
        if (prop.startsWith('--tw-'))
          continue

        // Resolve var() references
        value = resolveVarChain(value, vars)

        // Skip if still has unresolved vars
        if (value.includes('var('))
          continue

        // Convert oklch colors to hex
        if (COLOR_PROPERTIES.has(prop)) {
          value = convertColorToHex(value)
        }

        styles[prop] = value
      }

      if (Object.keys(styles).length > 0) {
        resolvedStyleCache.set(className, styles)
      }
      else {
        resolvedStyleCache.set(className, null)
      }
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

  // Handle gradient class combinations (requires multiple classes to work together)
  const hasGradientColors = fromClass || toClass
  if ((linearGradientDir || radialGradientShape) && hasGradientColors) {
    // Extract colors from vars
    const fromColor = fromClass ? resolveGradientColor(fromClass, vars) : null
    const viaColor = viaClass ? resolveGradientColor(viaClass, vars) : null
    const toColor = toClass ? resolveGradientColor(toClass, vars) : null

    if (fromColor || toColor) {
      const stops = [fromColor, viaColor, toColor].filter(Boolean).join(', ')

      if (linearGradientDir) {
        // Linear gradient: bg-gradient-to-r from-x to-y
        const direction = LINEAR_GRADIENT_DIRECTIONS[linearGradientDir] || 'to right'
        const gradientValue = `linear-gradient(${direction}, ${stops})`
        result[linearGradientDir] = { 'background-image': gradientValue }
      }
      else if (radialGradientShape) {
        // Radial gradient: bg-radial from-x to-y
        const shape = RADIAL_GRADIENT_SHAPES[radialGradientShape] || 'circle at center'
        const gradientValue = `radial-gradient(${shape}, ${stops})`
        result[radialGradientShape] = { 'background-image': gradientValue }
      }

      // Mark color classes as resolved (they contribute to the gradient)
      if (fromClass)
        result[fromClass] = {}
      if (viaClass)
        result[viaClass] = {}
      if (toClass)
        result[toClass] = {}
    }
  }

  return result
}

// Resolve gradient color class to hex value
function resolveGradientColor(cls: string, vars: Map<string, string>): string | null {
  // Extract color name from class (from-brand -> brand, to-accent -> accent)
  const colorName = cls.replace(/^(from|via|to)-/, '')

  // Check for color with shade (e.g., from-custom-400)
  const shadeMatch = colorName.match(/^(.+)-(\d+)$/)
  if (shadeMatch) {
    const [, baseName, shade] = shadeMatch
    const varName = `--color-${baseName}-${shade}`
    const value = vars.get(varName)
    if (value)
      return convertColorToHex(value)
  }

  // Check for single color (e.g., from-brand)
  const varName = `--color-${colorName}`
  const value = vars.get(varName)
  if (value)
    return convertColorToHex(value)

  return null
}

/** Clear the compiler cache (useful for HMR) */
export function clearTw4Cache() {
  cachedCompiler = null
  cachedCssPath = null
  cachedVars = null
  resolvedClassCache.clear()
  resolvedStyleCache.clear()
}
