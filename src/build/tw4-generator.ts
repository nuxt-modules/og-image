import { readFile } from 'node:fs/promises'
// @ts-expect-error no types
import { formatHex, parse, toGamut } from 'culori'
import { dirname } from 'pathe'
import postcss from 'postcss'
import postcssCustomProperties from 'postcss-custom-properties'

export interface StyleMap {
  classes: Map<string, Record<string, string>>
  vars: Map<string, string>
}

export interface GeneratorOptions {
  cssPath: string
  classes: string[]
  nuxtUiColors?: Record<string, string>
}

// Gamut map oklch to sRGB
const toSrgbGamut = toGamut('rgb', 'oklch')

function convertColorToHex(value: string): string {
  if (!value || value.includes('var('))
    return value
  try {
    const color = parse(value)
    if (!color)
      return value
    const mapped = toSrgbGamut(color)
    return formatHex(mapped) || value
  }
  catch {
    return value
  }
}

/**
 * Convert oklch colors in a CSS string to hex.
 */
function convertOklchToHex(css: string): string {
  return css.replace(/oklch\([^)]+\)/g, match => convertColorToHex(match))
}

/**
 * Build CSS variable declarations from various sources.
 * Expands Nuxt UI color names (e.g., { primary: 'indigo' }) to full CSS variable sets.
 */
async function buildVarsCSS(vars: Map<string, string>, nuxtUiColors?: Record<string, string>): Promise<string> {
  const lines: string[] = [':root {']

  // Add all collected vars
  for (const [name, value] of vars) {
    lines.push(`  ${name}: ${value};`)
  }

  // Expand Nuxt UI semantic colors to full variable sets
  if (nuxtUiColors) {
    const twColors = await import('tailwindcss/colors').then(m => m.default) as Record<string, Record<number, string>>
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

    for (const [semantic, twColor] of Object.entries(nuxtUiColors)) {
      // Add color shades (e.g., --ui-color-primary-500)
      for (const shade of shades) {
        const varName = `--ui-color-${semantic}-${shade}`
        const value = twColors[twColor]?.[shade]
        if (value && !vars.has(varName))
          lines.push(`  ${varName}: ${value};`)
      }
      // Add semantic variable (e.g., --ui-primary)
      if (!vars.has(`--ui-${semantic}`))
        lines.push(`  --ui-${semantic}: ${twColors[twColor]?.[500] || ''};`)
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
        lines.push(`  ${name}: ${value};`)
    }
  }

  lines.push('}')
  return lines.join('\n')
}

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
 * Parse CSS rules into a class → styles map.
 */
function parseClassStyles(css: string): Map<string, Record<string, string>> {
  const classMap = new Map<string, Record<string, string>>()
  const root = postcss.parse(css)

  root.walkRules((rule) => {
    // Only process simple class selectors
    const selector = rule.selector
    if (!selector.startsWith('.'))
      return

    // Handle escaped characters in class names (e.g., .\32xl → 2xl)
    let className = selector.slice(1) // Remove leading .

    // Decode hex escapes: \32 → 2, \3a → :
    className = className.replace(/\\([0-9a-f]+)\s?/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)))
    // Decode simple escapes: \: → :, \/ → /
    className = className.replace(/\\(.)/g, '$1')

    // Skip pseudo-classes and complex selectors
    if (className.includes(':') && !className.match(/^[\w-]+$/))
      return
    if (className.includes(' ') || className.includes('>') || className.includes('+'))
      return

    const styles: Record<string, string> = classMap.get(className) || {}

    rule.walkDecls((decl) => {
      // Skip CSS variables in output (already resolved)
      if (decl.prop.startsWith('--'))
        return

      // Convert property to camelCase for React/Satori
      const camelProp = decl.prop.replace(/-([a-z])/g, (_, l) => l.toUpperCase())
      styles[camelProp] = decl.value
    })

    if (Object.keys(styles).length > 0) {
      classMap.set(className, styles)
    }
  })

  return classMap
}

/**
 * Generate a complete style map from TW4 classes.
 *
 * Flow:
 * 1. Compile classes with TW4 → raw CSS with vars
 * 2. Extract vars from CSS
 * 3. Build :root with all vars + Nuxt UI vars
 * 4. Prepend to CSS
 * 5. Run postcss-custom-properties to resolve vars
 * 6. Convert oklch → hex
 * 7. Parse into class map
 */
export async function generateStyleMap(options: GeneratorOptions): Promise<StyleMap> {
  const { cssPath, classes, nuxtUiColors } = options

  if (classes.length === 0) {
    return { classes: new Map(), vars: new Map() }
  }

  // 1. Compile with TW4
  const { compile } = await import('tailwindcss')
  const { resolveModulePath } = await import('exsolve')
  const cssContent = await readFile(cssPath, 'utf-8')
  const baseDir = dirname(cssPath)

  const compiler = await compile(cssContent, {
    base: baseDir,
    loadStylesheet: async (id: string, base: string) => {
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
        const { join } = await import('pathe')
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
    },
  })

  // Build candidates string (space-separated classes)
  const candidates = classes.join(' ')
  const rawCSS = compiler.build(candidates.split(' '))

  // 2. Extract vars from TW4 output
  const vars = extractVars(rawCSS)

  // 3. Build :root CSS with all vars (includes expanded Nuxt UI colors)
  const varsCSS = await buildVarsCSS(vars, nuxtUiColors)

  // 4. Combine: vars first, then class rules
  const fullCSS = `${varsCSS}\n${rawCSS}`

  // 5. Run postcss plugins to resolve vars and calc expressions
  const postcssCalc = (await import('postcss-calc')).default
  const result = await postcss([
    postcssCustomProperties({
      preserve: false, // Remove var() after resolving
    }),
    postcssCalc({}), // Evaluate calc() expressions
  ]).process(fullCSS, { from: undefined })

  const resolvedCSS = result.css

  // 6. Convert oklch colors to hex (Satori doesn't support oklch)
  const hexCSS = convertOklchToHex(resolvedCSS)

  // 7. Parse into class map
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
