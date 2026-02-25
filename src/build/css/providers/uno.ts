import type { UserConfig } from '@unocss/core'
import type { CssProvider } from '../css-provider'
import type { ExtractedCssVars } from '../css-utils'
import { readFile } from 'node:fs/promises'
import { defu } from 'defu'
import { logger } from '../../../runtime/logger'
import { extractVariantBaseClasses, resolveVariantPrefixes } from '../css-provider'
import { extractClassStyles, extractCssVars, extractPerClassVars, extractPropertyInitialValues, extractUniversalVars, extractVarsFromCss, postProcessStyles, resolveExtractedVars, simplifyCss } from '../css-utils'

export interface UnoProviderOptions {
  resolveCssPath?: () => Promise<string | undefined>
}

// State
let unoConfig: UserConfig | null = null
let rootDir: string | null = null
type UnoGen = Awaited<ReturnType<typeof import('@unocss/core').createGenerator>>
let generator: UnoGen | null = null
let pendingGenerator: Promise<UnoGen> | null = null
let cachedExtracted: ExtractedCssVars | null = null

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
 * Clear cached user CSS vars (for HMR when CSS files change).
 */
export function clearUnoUserVarsCache(): void {
  cachedExtracted = null
}

/**
 * Clear all cached state including generator (for HMR when uno.config changes).
 */
export function clearUnoCache(): void {
  generator = null
  pendingGenerator = null
  cachedExtracted = null
}

async function getGenerator(): Promise<UnoGen> {
  if (generator)
    return generator

  // Deduplicate concurrent generator creation during HMR cache invalidation
  if (pendingGenerator)
    return pendingGenerator

  pendingGenerator = (async () => {
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
      ? defu(unoConfig || {}, loadedConfig) as UserConfig
      : unoConfig

    if (!finalConfig) {
      throw new Error('UnoCSS config not found. Ensure uno.config.ts exists or @unocss/nuxt is loaded.')
    }

    const { createGenerator } = await import('@unocss/core')
    generator = await createGenerator(finalConfig)
    return generator
  })()

  const p = pendingGenerator!
  p.finally(() => {
    pendingGenerator = null
  })
  return p
}

async function loadExtractedVars(resolveCssPath?: () => Promise<string | undefined>): Promise<ExtractedCssVars> {
  if (cachedExtracted)
    return cachedExtracted
  const empty: ExtractedCssVars = { rootVars: new Map(), qualifiedRules: [], universalVars: new Map(), propertyInitials: new Map(), perClassVars: new Map() }
  if (!resolveCssPath) {
    cachedExtracted = empty
    return cachedExtracted
  }
  const cssPath = await resolveCssPath()
  if (!cssPath) {
    logger.debug('[og-image UnoCSS] No CSS path resolved for user vars')
    cachedExtracted = empty
    return cachedExtracted
  }
  try {
    const content = await readFile(cssPath, 'utf-8')
    cachedExtracted = await extractVarsFromCss(content)
    logger.debug(`[og-image UnoCSS] Extracted ${cachedExtracted.rootVars.size} base vars, ${cachedExtracted.qualifiedRules.length} qualified rules from ${cssPath}`)
  }
  catch (e) {
    logger.warn('[og-image UnoCSS] Failed to read CSS file for vars:', (e as Error).message)
    cachedExtracted = empty
  }
  return cachedExtracted
}

function resolveUserVars(extracted: ExtractedCssVars, rootAttrs: Record<string, string>): Map<string, string> {
  return resolveExtractedVars(extracted, rootAttrs)
}

/**
 * Create UnoCSS provider instance.
 */
export function createUnoProvider(options?: UnoProviderOptions): CssProvider {
  return {
    name: 'unocss',

    async resolveClassesToStyles(classes: string[], context?: string, rootAttrs?: Record<string, string>): Promise<Record<string, Record<string, string> | string>> {
      if (classes.length === 0)
        return {}

      // Extract base classes from prefixed variants (e.g., md:bg-blue-500 → bg-blue-500)
      // so UnoCSS generates their styles too (needed for arbitrary class rewrites)
      const baseClasses = extractVariantBaseClasses(classes)
      const classesToGenerate = [...new Set([...classes, ...baseClasses])]

      const gen = await getGenerator()
      const { css } = await gen.generate(classesToGenerate)

      const simplifiedCss = await simplifyCss(css)

      // Extract CSS variables from all sources
      const vars = new Map<string, string>()

      // User CSS vars (e.g., --bg, --fg from app's main.css)
      // Uses AST-based extraction to handle compound :root selectors and attribute matching
      const extracted = await loadExtractedVars(options?.resolveCssPath)
      const userVars = resolveUserVars(extracted, rootAttrs || {})
      for (const [name, value] of userVars)
        vars.set(name, value)

      // Generated CSS vars use regex (lightningcss visitor can't handle var() in property values)
      const rootVarsFromCss = extractCssVars(simplifiedCss)
      for (const [name, value] of rootVarsFromCss)
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

      logger.debug(`[og-image UnoCSS] Vars: ${userVars.size} user, ${rootVarsFromCss.size} :root, ${propVars.size} @property, ${uniVars.size} universal → ${vars.size} total`)

      // Per-class CSS variable overrides (e.g., .shadow-lg { --un-shadow: ... })
      const perClassVars = extractPerClassVars(simplifiedCss)

      // Extract class styles, collecting additional vars
      // Note: walkClassRules only matches top-level rules — @media-wrapped responsive
      // classes (e.g., md:bg-blue-500) won't appear here, which is expected.
      // We resolve their base classes instead and rewrite as prefixed arbitrary classes.
      const classMap = extractClassStyles(simplifiedCss, { collectVars: vars, merge: true })

      // Resolve all base class styles (including those extracted from prefixed variants)
      const resolvedBaseStyles = new Map<string, Record<string, string>>()
      for (const [className, rawStyles] of classMap) {
        const classVars = perClassVars.get(className)
        const mergedVars = classVars ? new Map([...vars, ...classVars]) : vars
        const styles = await postProcessStyles(rawStyles, mergedVars, undefined, context)
        if (styles)
          resolvedBaseStyles.set(className, styles)
      }

      // Apply variant-prefix-aware resolution (shared with TW4 provider)
      return resolveVariantPrefixes(classes, resolvedBaseStyles)
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

    async getVars(rootAttrs?: Record<string, string>) {
      const extracted = await loadExtractedVars(options?.resolveCssPath)
      return resolveUserVars(extracted, rootAttrs || {})
    },

    clearUserVarsCache: clearUnoUserVarsCache,
    clearCache: clearUnoCache,

    async resolveIcon(prefix: string, name: string) {
      const gen = await getGenerator()
      const iconClass = `i-${prefix}-${name}`
      const { css } = await gen.generate([iconClass])
      if (!css)
        return null

      // Extract SVG from data URL in the generated CSS (--un-icon or mask-image)
      const urlMatch = css.match(/url\("data:image\/svg\+xml[;,]([^"]+)"\)/)
      if (!urlMatch?.[1])
        return null

      let svgContent: string
      if (urlMatch[0].includes(';base64,')) {
        svgContent = Buffer.from(urlMatch[1], 'base64').toString('utf-8')
      }
      else {
        // Percent-encoded (default for presetIcons), may have utf8, prefix
        const raw = urlMatch[1].replace(/^utf8,/, '')
        svgContent = decodeURIComponent(raw)
      }

      // Handle both single and double quotes in SVG attributes
      const viewBoxMatch = svgContent.match(/viewBox=['"](\d+)\s+(\d+)\s+(\d+)\s+(\d+)['"]/)
      const widthAttr = svgContent.match(/\bwidth=['"](\d+)['"]/)
      const heightAttr = svgContent.match(/\bheight=['"](\d+)['"]/)

      const width = viewBoxMatch?.[3] ? Number.parseInt(viewBoxMatch[3]) : (widthAttr?.[1] ? Number.parseInt(widthAttr[1]) : 24)
      const height = viewBoxMatch?.[4] ? Number.parseInt(viewBoxMatch[4]) : (heightAttr?.[1] ? Number.parseInt(heightAttr[1]) : 24)

      // Extract inner body
      const bodyMatch = svgContent.match(/<svg[^>]*>([\s\S]*)<\/svg>/)
      if (!bodyMatch?.[1])
        return null

      return { body: bodyMatch[1], width, height }
    },
  }
}
