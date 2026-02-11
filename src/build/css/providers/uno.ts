import type { UserConfig } from '@unocss/core'
import type { CssProvider } from '../css-provider'
import { readFile } from 'node:fs/promises'
import { logger } from '../../../runtime/logger'
import { extractClassStyles, extractCssVars, extractPerClassVars, extractPropertyInitialValues, extractUniversalVars, extractVarsFromCss, postProcessStyles, resolveExtractedVars, simplifyCss } from '../css-utils'

export interface UnoProviderOptions {
  resolveCssPath?: () => Promise<string | undefined>
  resolveColorPreference?: () => 'light' | 'dark'
}

// State
let unoConfig: UserConfig | null = null
let rootDir: string | null = null
let generator: Awaited<ReturnType<typeof import('@unocss/core').createGenerator>> | null = null
let cachedUserVars: Map<string, string> | null = null

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
  cachedUserVars = null
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

async function loadUserVars(resolveCssPath?: () => Promise<string | undefined>, resolveColorPreference?: () => 'light' | 'dark'): Promise<Map<string, string>> {
  if (cachedUserVars)
    return cachedUserVars
  cachedUserVars = new Map()
  if (!resolveCssPath)
    return cachedUserVars
  const cssPath = await resolveCssPath()
  if (!cssPath) {
    logger.debug('[og-image UnoCSS] No CSS path resolved for user vars')
    return cachedUserVars
  }
  try {
    const content = await readFile(cssPath, 'utf-8')
    const extracted = await extractVarsFromCss(content)
    const colorPreference = resolveColorPreference?.() || 'light'
    const resolved = resolveExtractedVars(extracted, colorPreference)
    for (const [name, value] of resolved)
      cachedUserVars.set(name, value)
    logger.debug(`[og-image UnoCSS] Loaded ${cachedUserVars.size} user CSS vars (${colorPreference} mode) from ${cssPath}`)
    if (extracted.darkVars.size || extracted.lightVars.size) {
      logger.debug(`[og-image UnoCSS] Theme vars: ${extracted.rootVars.size} base, ${extracted.darkVars.size} dark, ${extracted.lightVars.size} light`)
    }
  }
  catch (e) {
    logger.warn('[og-image UnoCSS] Failed to read CSS file for vars:', (e as Error).message)
  }
  return cachedUserVars
}

/**
 * Create UnoCSS provider instance.
 */
export function createUnoProvider(options?: UnoProviderOptions): CssProvider {
  return {
    name: 'unocss',

    async resolveClassesToStyles(classes: string[], context?: string): Promise<Record<string, Record<string, string>>> {
      if (classes.length === 0)
        return {}

      const gen = await getGenerator()
      const { css } = await gen.generate(classes)

      const simplifiedCss = await simplifyCss(css)

      // Extract CSS variables from all sources
      const vars = new Map<string, string>()

      // User CSS vars (e.g., --bg, --fg from app's main.css)
      // Uses AST-based extraction to handle compound :root selectors and color mode
      const userVars = await loadUserVars(options?.resolveCssPath, options?.resolveColorPreference)
      for (const [name, value] of userVars)
        vars.set(name, value)

      // Generated CSS vars use regex (lightningcss visitor can't handle var() in property values)
      const rootVars = extractCssVars(simplifiedCss)
      for (const [name, value] of rootVars)
        vars.set(name, value)

      const propVars = extractPropertyInitialValues(simplifiedCss)
      for (const [name, value] of propVars) {
        if (!vars.has(name))
          vars.set(name, value)
      }

      const uniVars = extractUniversalVars(simplifiedCss)
      for (const [name, value] of uniVars) {
        if (!vars.has(name))
          vars.set(name, value)
      }

      logger.debug(`[og-image UnoCSS] Vars: ${userVars.size} user, ${rootVars.size} :root, ${propVars.size} @property, ${uniVars.size} universal → ${vars.size} total`)

      // Per-class CSS variable overrides (e.g., .shadow-lg { --un-shadow: ... })
      const perClassVars = extractPerClassVars(simplifiedCss)

      // Extract class styles, collecting additional vars
      const classMap = extractClassStyles(simplifiedCss, { collectVars: vars })

      const result: Record<string, Record<string, string>> = {}

      for (const [className, rawStyles] of classMap) {
        // Merge global vars with per-class overrides
        const classVars = perClassVars.get(className)
        const mergedVars = classVars ? new Map([...vars, ...classVars]) : vars
        const styles = await postProcessStyles(rawStyles, mergedVars, undefined, context)
        if (styles)
          result[className] = styles
      }

      return result
    },

    async extractMetadata() {
      const gen = await getGenerator()
      const theme = gen.config.theme as Record<string, any> || {}
      const fontVars: Record<string, string> = {}
      const breakpoints: Record<string, number> = {}
      const colors: Record<string, string | Record<string, string>> = {}

      // Extract font families (e.g., { sans: "'Geist', sans-serif" } → { 'font-sans': "'Geist', sans-serif" })
      if (theme.font) {
        for (const [name, value] of Object.entries(theme.font)) {
          if (typeof value === 'string')
            fontVars[`font-${name}`] = value
        }
      }
      // Also check fontFamily (used by some UnoCSS presets)
      if (theme.fontFamily) {
        for (const [name, value] of Object.entries(theme.fontFamily)) {
          if (typeof value === 'string')
            fontVars[`font-${name}`] = value
        }
      }

      // Extract breakpoints (e.g., { sm: '640px', md: '768px' } → { sm: 640, md: 768 })
      if (theme.breakpoints) {
        for (const [name, value] of Object.entries(theme.breakpoints)) {
          const px = Number.parseInt(String(value).replace('px', ''), 10)
          if (!Number.isNaN(px))
            breakpoints[name] = px
        }
      }

      // Extract colors (flatten nested color objects)
      if (theme.colors) {
        for (const [name, value] of Object.entries(theme.colors)) {
          if (typeof value === 'string')
            colors[name] = value
          else if (typeof value === 'object' && value !== null)
            colors[name] = value as Record<string, string>
        }
      }

      return { fontVars, breakpoints, colors }
    },

    async getVars() {
      return loadUserVars(options?.resolveCssPath, options?.resolveColorPreference)
    },

    clearCache: clearUnoCache,
  }
}
