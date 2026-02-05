import type { UserConfig } from '@unocss/core'
import type { CssProvider } from '../css-provider'
import { logger } from '../../../runtime/logger'
import { COLOR_PROPERTIES, convertColorToHex, extractClassStyles, simplifyCss } from '../css-utils'

// State
let unoConfig: UserConfig | null = null
let rootDir: string | null = null
let generator: Awaited<ReturnType<typeof import('@unocss/core').createGenerator>> | null = null

/**
 * Set root directory for loading uno.config.ts
 */
export function setUnoRootDir(dir: string): void {
  rootDir = dir
}

/**
 * Set UnoCSS config (called from module.ts via unocss:config hook).
 * Note: This config may be partial - user's uno.config.ts is loaded separately.
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

  // Always load user's uno.config.ts to get theme customizations
  let loadedConfig: UserConfig | undefined
  try {
    const { loadConfig } = await import('@unocss/config')
    const result = await loadConfig(rootDir || process.cwd())
    loadedConfig = result.config
  }
  catch (e) {
    logger.warn('[og-image UnoCSS] Failed to load uno.config.ts:', (e as Error).message)
  }

  // Merge loaded config with any hook config (hook config may have Nuxt-specific settings)
  const finalConfig = loadedConfig
    ? { ...loadedConfig, ...unoConfig, theme: { ...loadedConfig.theme, ...unoConfig?.theme } }
    : unoConfig

  if (!finalConfig) {
    throw new Error('UnoCSS config not found. Ensure uno.config.ts exists or @unocss/nuxt is loaded.')
  }

  const { createGenerator } = await import('@unocss/core')
  generator = await createGenerator(finalConfig)
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
 * Parse generated CSS into class → styles map using Lightning CSS.
 */
async function parseGeneratedCss(css: string): Promise<Record<string, Record<string, string>>> {
  // Simplify calc() expressions with Lightning CSS
  const simplifiedCss = await simplifyCss(css)

  // Extract class styles using regex-based parser
  const classMap = extractClassStyles(simplifiedCss)

  const result: Record<string, Record<string, string>> = {}

  for (const [className, rawStyles] of classMap) {
    // First pass: collect CSS variables from this class
    // (UnoCSS puts --un-* vars in the same rule)
    const vars = new Map<string, string>()

    // Re-extract with vars from the original CSS for this class
    const classRe = new RegExp(`\\.${escapeRegex(className)}\\s*\\{([^}]+)\\}`)
    const classMatch = simplifiedCss.match(classRe)
    if (classMatch?.[1]) {
      // Safe: value starts with [^\s;] to prevent overlap with \s*
      const varRe = /(--un-[\w-]+)\s*:\s*([^\s;][^;]*);/g
      for (const m of classMatch[1].matchAll(varRe)) {
        if (m[1] && m[2])
          vars.set(m[1], m[2].trim())
      }
    }

    const styles: Record<string, string> = {}

    for (const [prop, rawValue] of Object.entries(rawStyles)) {
      let value = rawValue

      // Resolve UnoCSS var() references
      if (value.includes('var(--un-'))
        value = resolveUnoVars(value, vars)

      // Convert colors to hex for rendering
      if (COLOR_PROPERTIES.has(prop))
        value = convertColorToHex(value)

      // Normalize opacity percentage to decimal (CSS standard is unitless 0-1)
      if (prop === 'opacity' && value.endsWith('%'))
        value = String(Number.parseFloat(value) / 100)

      styles[prop] = value
    }

    if (Object.keys(styles).length > 0)
      result[className] = styles
  }

  return result
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
