import { readFile } from 'node:fs/promises'
import { dirname } from 'pathe'
import postcss from 'postcss'
import postcssCalc from 'postcss-calc'
import postcssCustomProperties from 'postcss-custom-properties'
import { compile } from 'tailwindcss'
import { buildNuxtUiVars, convertOklchToHex, createStylesheetLoader, decodeCssClassName } from './tw4-utils'

export interface StyleMap {
  classes: Map<string, Record<string, string>>
  vars: Map<string, string>
}

export interface GeneratorOptions {
  cssPath: string
  classes: string[]
  nuxtUiColors?: Record<string, string>
}

/**
 * Build CSS variable declarations from various sources.
 */
function buildVarsCSS(vars: Map<string, string>, nuxtUiColors?: Record<string, string>): string {
  // Expand Nuxt UI colors into vars map
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
    const selector = rule.selector
    if (!selector.startsWith('.'))
      return

    const className = decodeCssClassName(selector)

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
  const cssContent = await readFile(cssPath, 'utf-8')
  const baseDir = dirname(cssPath)

  const compiler = await compile(cssContent, {
    base: baseDir,
    loadStylesheet: createStylesheetLoader(baseDir),
  })

  const rawCSS = compiler.build(classes)

  // 2. Extract vars from TW4 output
  const vars = extractVars(rawCSS)

  // 3. Build :root CSS with all vars (includes expanded Nuxt UI colors)
  const varsCSS = buildVarsCSS(vars, nuxtUiColors)

  // 4. Combine: vars first, then class rules
  const fullCSS = `${varsCSS}\n${rawCSS}`

  // 5. Run postcss plugins to resolve vars and calc expressions
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
