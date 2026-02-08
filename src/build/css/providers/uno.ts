import type { UserConfig } from '@unocss/core'
import type { CssProvider } from '../css-provider'
import { logger } from '../../../runtime/logger'
import { extractClassStyles, extractCssVars, extractPerClassVars, extractPropertyInitialValues, extractUniversalVars, postProcessStyles, simplifyCss } from '../css-utils'

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
 */
export function setUnoConfig(config: UserConfig): void {
  unoConfig = config
  generator = null
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

  let loadedConfig: UserConfig | undefined
  try {
    const { loadConfig } = await import('@unocss/config')
    const result = await loadConfig(rootDir || process.cwd())
    loadedConfig = result.config
  }
  catch (e) {
    logger.warn('[og-image UnoCSS] Failed to load uno.config.ts:', (e as Error).message)
  }

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

      const simplifiedCss = await simplifyCss(css)

      // Extract CSS variables from all sources
      const vars = new Map<string, string>()

      // :root/:host variables (e.g., --spacing: 0.25rem)
      for (const [name, value] of extractCssVars(simplifiedCss))
        vars.set(name, value)

      // @property initial-values (CSS Houdini defaults for shadow/ring vars)
      for (const [name, value] of extractPropertyInitialValues(simplifiedCss)) {
        if (!vars.has(name))
          vars.set(name, value)
      }

      // Universal selector variables (*, ::before, ::after)
      // Provides defaults for --un-shadow, --un-ring-shadow, etc.
      for (const [name, value] of extractUniversalVars(simplifiedCss)) {
        if (!vars.has(name))
          vars.set(name, value)
      }

      // Per-class CSS variable overrides (e.g., .shadow-lg { --un-shadow: ... })
      const perClassVars = extractPerClassVars(simplifiedCss)

      // Extract class styles, collecting additional vars
      const classMap = extractClassStyles(simplifiedCss, { collectVars: vars })

      const result: Record<string, Record<string, string>> = {}

      for (const [className, rawStyles] of classMap) {
        // Merge global vars with per-class overrides
        const classVars = perClassVars.get(className)
        const mergedVars = classVars ? new Map([...vars, ...classVars]) : vars
        const styles = await postProcessStyles(rawStyles, mergedVars)
        if (styles)
          result[className] = styles
      }

      return result
    },

    clearCache: clearUnoCache,
  }
}
