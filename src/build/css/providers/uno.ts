import type { UserConfig } from '@unocss/core'
import type { CssProvider } from '../css-provider'
import { COLOR_PROPERTIES, convertColorToHex, decodeCssClassName, loadPostcss } from '../css-utils'

// State
let unoConfig: UserConfig | null = null
let generator: Awaited<ReturnType<typeof import('@unocss/core').createGenerator>> | null = null

/**
 * Set UnoCSS config (called from module.ts via unocss:config hook).
 */
export function setUnoConfig(config: UserConfig): void {
  unoConfig = config
  generator = null // Reset generator on config change
}

/**
 * Clear cached state (for HMR).
 */
export function clearUnoCache(): void {
  generator = null
}

async function getGenerator() {
  if (generator)
    return generator

  if (!unoConfig)
    throw new Error('UnoCSS config not set. Ensure @unocss/nuxt is loaded before og-image.')

  const { createGenerator } = await import('@unocss/core')
  generator = await createGenerator(unoConfig)
  return generator
}

/**
 * Resolve UnoCSS var() references in a value.
 * Handles patterns like: rgb(34 197 94 / var(--un-bg-opacity))
 */
function resolveUnoVars(value: string, vars: Map<string, string>): string {
  return value.replace(/var\((--un-[\w-]+)\)/g, (_, varName) => {
    return vars.get(varName) || '1' // Default opacity to 1
  })
}

/**
 * Parse generated CSS into class → styles map.
 */
async function parseGeneratedCss(css: string): Promise<Record<string, Record<string, string>>> {
  const { postcss, postcssCalc } = await loadPostcss()

  // Evaluate calc() expressions
  const processed = await postcss([postcssCalc({})]).process(css, { from: undefined })
  const root = postcss.parse(processed.css)

  const result: Record<string, Record<string, string>> = {}

  root.walkRules((rule) => {
    const selector = rule.selector
    if (!selector.startsWith('.'))
      return

    // Skip pseudo-classes, combinators
    if (selector.includes(':') || selector.includes(' ') || selector.includes('>'))
      return

    const className = decodeCssClassName(selector)
    const styles: Record<string, string> = {}

    // First pass: collect CSS variables from this rule
    const vars = new Map<string, string>()
    rule.walkDecls((decl) => {
      if (decl.prop.startsWith('--un-'))
        vars.set(decl.prop, decl.value)
    })

    // Second pass: process non-variable declarations
    rule.walkDecls((decl) => {
      // Skip CSS variables
      if (decl.prop.startsWith('--'))
        return

      let value = decl.value

      // Resolve UnoCSS var() references
      if (value.includes('var(--un-'))
        value = resolveUnoVars(value, vars)

      // Convert colors to hex for Satori
      if (COLOR_PROPERTIES.has(decl.prop)) {
        value = convertColorToHex(value)
      }

      styles[decl.prop] = value
    })

    if (Object.keys(styles).length > 0) {
      result[className] = styles
    }
  })

  return result
}

/**
 * Create UnoCSS provider instance.
 */
export function createUnoProvider(): CssProvider {
  return {
    name: 'unocss',

    async resolveClassesToStyles(classes: string[]): Promise<Record<string, Record<string, string>>> {
      if (classes.length === 0)
        return {}

      const gen = await getGenerator()
      const { css } = await gen.generate(classes)
      return parseGeneratedCss(css)
    },

    clearCache: clearUnoCache,
  }
}
