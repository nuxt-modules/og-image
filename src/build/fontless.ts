/**
 * Fontless/unifont integration for static font resolution.
 *
 * Satori can't handle WOFF2 or variable fonts — this module uses fontless
 * (backed by unifont providers: Fontsource, Google, Bunny) to download
 * static TTF/WOFF alternatives.
 *
 * Both `fontless` and `unifont` are optional peer dependencies.
 */

import type { ConsolaInstance } from 'consola'
import type { FontFamilyProviderOverride, FontlessOptions, Resolver } from 'fontless'
import type { Nuxt } from 'nuxt/schema'
import type { FontRequirementsState, ParsedFont } from './fonts'
import * as fs from 'node:fs'
import { join } from 'pathe'
import { extractCustomFontFamilies } from './css/css-utils'
import { downloadFontFile, fontKey, FONTS_URL_PREFIX, getStaticInterFonts, matchesFontRequirements, parseFontsFromTemplate } from './fonts'

// ============================================================================
// Types
// ============================================================================

export interface ProcessFontsOptions {
  nuxt: Nuxt
  logger: ConsolaInstance
  fontRequirements: FontRequirementsState
  convertedWoff2Files: Set<string>
  fontSubsets?: string[]
}

interface DownloadedFont {
  family: string
  weight: number
  style: string
  format: string
  filename: string
}

// ============================================================================
// Fontless Resolver (attached to nuxt instance)
// ============================================================================

interface FontlessContext {
  resolver: Resolver
  renderedFontURLs: Map<string, string>
}

function getFontlessContext(nuxt: Nuxt): FontlessContext | undefined {
  return (nuxt as any)._ogImageFontless
}

export async function initFontless(options: {
  nuxt: Nuxt
  logger?: ConsolaInstance
}): Promise<void> {
  if (getFontlessContext(options.nuxt))
    return

  // Lazy-load optional peer deps
  const [{ createResolver, normalizeFontData }, { providers: unifontProviders }] = await Promise.all([
    import('fontless'),
    import('unifont'),
  ])

  const renderedFontURLs = new Map<string, string>()

  const providers = {
    fontsource: unifontProviders.fontsource,
    google: unifontProviders.google,
    bunny: unifontProviders.bunny,
  } as Record<string, (opts: unknown) => any>

  // Honour user's @nuxt/fonts families config (provider overrides, custom sources, etc.)
  const nuxtFontsConfig = (options.nuxt.options as any).fonts as FontlessOptions | undefined
  const userFamilies = nuxtFontsConfig?.families

  const resolver = await createResolver({
    normalizeFontData: faces => normalizeFontData(
      {
        dev: false,
        renderedFontURLs,
        assetsBaseURL: FONTS_URL_PREFIX,
        callback: (filename, url) => renderedFontURLs.set(filename, url),
      },
      faces,
    ),
    logger: options.logger,
    options: {
      families: userFamilies,
      // Google first — only provider with reliable WOFF format negotiation via user-agent.
      // fontsource/bunny serve WOFF2-only for most fonts, and unifont's cascade stops
      // at the first provider that recognizes the family (even if it returns empty fonts
      // after format filtering), so they must come after Google.
      priority: nuxtFontsConfig?.priority || ['google', 'bunny', 'fontsource'],
      defaults: {
        weights: [400, 700],
        styles: ['normal', 'italic'],
        subsets: ['latin'],
        // Satori can't use WOFF2 — request WOFF (static) format from providers
        formats: ['woff'],
      },
    },
    providers,
  })

  options.logger?.debug(`fontless initialized with formats: ['woff'], priority: ${JSON.stringify(nuxtFontsConfig?.priority || ['google', 'bunny', 'fontsource'])}`)

  ;(options.nuxt as any)._ogImageFontless = { resolver, renderedFontURLs } satisfies FontlessContext
}

// ============================================================================
// Font URL Persistence
// ============================================================================

/** Persist @nuxt/fonts URL mapping to disk for prerender. */
export function persistFontUrlMapping(options: {
  fontContext: { renderedFontURLs: Map<string, string> } | null
  buildDir: string
  logger: ConsolaInstance
}): void {
  if (!options.fontContext?.renderedFontURLs.size)
    return
  const cacheDir = join(options.buildDir, 'cache', 'og-image')
  fs.mkdirSync(cacheDir, { recursive: true })
  const mapping = Object.fromEntries(options.fontContext.renderedFontURLs)
  fs.writeFileSync(join(cacheDir, 'font-urls.json'), JSON.stringify(mapping))
  options.logger.debug(`Persisted ${options.fontContext.renderedFontURLs.size} font URLs for prerender`)
}

// ============================================================================
// Static Font Download Pipeline
// ============================================================================

/**
 * Resolve font families via fontless → download static TTF/WOFF files to disk.
 * Combines resolution and download into a single pipeline.
 */
async function downloadStaticFonts(options: {
  families: { family: string, weights: number[], styles: Array<'normal' | 'italic'> }[]
  nuxt: Nuxt
  logger: ConsolaInstance
  filenameFromUrl?: boolean
}): Promise<DownloadedFont[]> {
  if (options.families.length === 0)
    return []

  const ttfDir = join(options.nuxt.options.buildDir, 'cache', 'og-image', 'fonts-ttf')
  fs.mkdirSync(ttfDir, { recursive: true })

  await initFontless({ nuxt: options.nuxt, logger: options.logger })
  const fontlessCtx = getFontlessContext(options.nuxt)
  if (!fontlessCtx) {
    options.logger.warn('fontless not initialized, cannot resolve static font fallbacks')
    return []
  }

  const results: DownloadedFont[] = []

  for (const { family, weights, styles } of options.families) {
    try {
      const resolution = await fontlessCtx.resolver(family, { name: family, weights, styles } as FontFamilyProviderOverride)
      if (!resolution?.fonts?.length) {
        options.logger.debug(`No fonts found for ${family} via fontless`)
        continue
      }

      for (const font of resolution.fonts) {
        const srcs = Array.isArray(font.src) ? font.src : [font.src]
        for (const src of srcs) {
          if (typeof src !== 'object' || !('url' in src))
            continue
          // fontless normalizeFontData rewrites URLs to local asset paths (/_fonts/...)
          // Use originalURL (the actual remote URL) for downloading
          const url = (src as any).originalURL || src.url
          const format = src.format || (url.endsWith('.woff') ? 'woff' : url.endsWith('.ttf') ? 'truetype' : undefined)
          if (format !== 'truetype' && format !== 'woff')
            continue
          const weight = typeof font.weight === 'number' ? font.weight : 400
          const style = font.style || 'normal'
          if (!weights.includes(weight) || !styles.includes(style as 'normal' | 'italic'))
            continue

          const ext = format === 'truetype' ? 'ttf' : 'woff'
          const filename = options.filenameFromUrl
            ? (url.split('/').pop() || `${family}-${weight}.${ext}`).replace(/[^a-z0-9.-]/gi, '_')
            : `${family.replace(/[^a-z0-9]/gi, '_')}-${weight}-${style}.${ext}`

          const destPath = join(ttfDir, filename)
          if (!await downloadFontFile(url, destPath))
            continue

          results.push({ family, weight, style, format, filename })
          options.logger.debug(`Resolved static font: ${family} ${weight}`)
        }
      }
    }
    catch (err) {
      options.logger.debug(`Failed to resolve fallback font for ${family}:`, err)
    }
  }

  return results
}

// ============================================================================
// WOFF2 → TTF Conversion (Satori Compat)
// ============================================================================

/**
 * Process WOFF2 fonts for Satori compatibility.
 * Satori can't use WOFF2 directly — uses fontless to download static TTF/WOFF alternatives.
 */
export async function convertWoff2ToTtf(options: ProcessFontsOptions): Promise<void> {
  const { nuxt, logger, fontRequirements, convertedWoff2Files, fontSubsets } = options

  const parsedFonts = await parseFontsFromTemplate(nuxt, { convertedWoff2Files, fontSubsets })

  // Filter to WOFF2 fonts that need processing (no WOFF/TTF alternative available)
  const hasNonWoff2 = new Set(
    parsedFonts
      .filter(f => !f.src.endsWith('.woff2'))
      .map(f => fontKey(f)),
  )

  const woff2Fonts = parsedFonts.filter(f =>
    f.src.endsWith('.woff2')
    && !hasNonWoff2.has(fontKey(f))
    && matchesFontRequirements(f, fontRequirements),
  )

  if (woff2Fonts.length === 0) {
    logger.debug('No WOFF2 fonts to process')
    return
  }

  // Group WOFF2 fonts by family and collect needed weights/styles
  const familyMap = new Map<string, { weights: Set<number>, styles: Set<'normal' | 'italic'> }>()
  for (const font of woff2Fonts) {
    const existing = familyMap.get(font.family) || { weights: new Set(), styles: new Set() }
    existing.weights.add(font.weight)
    existing.styles.add(font.style as 'normal' | 'italic')
    familyMap.set(font.family, existing)
  }

  const families = Array.from(familyMap.entries()).map(([family, { weights, styles }]) => ({
    family,
    weights: Array.from(weights),
    styles: Array.from(styles),
  }))

  logger.info(`Resolving static fonts for: ${families.map(f => f.family).join(', ')}`)

  try {
    const downloaded = await downloadStaticFonts({
      families,
      nuxt,
      logger,
      filenameFromUrl: true,
    })

    for (const font of downloaded)
      convertedWoff2Files.add(font.filename)

    if (convertedWoff2Files.size > 0) {
      logger.info(`Resolved ${convertedWoff2Files.size} static font files via fontless`)
    }
    else {
      logger.warn(`No static fonts available for Satori. Falling back to bundled Inter font. Consider using 'takumi' renderer for variable font support.`)
    }
  }
  catch (err) {
    logger.debug('fontless resolution failed:', err)
  }
}

// ============================================================================
// Missing Font Family Resolution
// ============================================================================

/**
 * Resolve font families not available from @nuxt/fonts global CSS.
 * Downloads static font files via fontless (Fontsource, Google, Bunny).
 */
export async function resolveMissingFontFamilies(options: {
  missingFamilies: string[]
  weights: number[]
  styles: Array<'normal' | 'italic'>
  nuxt: Nuxt
  logger: ConsolaInstance
}): Promise<ParsedFont[]> {
  const { missingFamilies, weights, styles, nuxt, logger } = options

  const families = missingFamilies.map(family => ({ family, weights, styles }))
  const downloaded = await downloadStaticFonts({ families, nuxt, logger })

  const results = downloaded.map(f => ({
    family: f.family,
    src: `${FONTS_URL_PREFIX}/${f.filename}`,
    weight: f.weight,
    style: f.style,
    satoriSrc: `${FONTS_URL_PREFIX}/${f.filename}`,
  }))

  if (results.length > 0)
    logger.info(`Resolved ${results.length} font files via fontless for: ${missingFamilies.join(', ')}`)

  return results
}

// ============================================================================
// Font Resolution Orchestrator
// ============================================================================

/**
 * Resolve the final set of fonts for OG image rendering.
 * Handles @nuxt/fonts parsing, missing family resolution, requirements filtering,
 * and satori fallback logic.
 */
export async function resolveOgImageFonts(options: {
  nuxt: Nuxt
  hasNuxtFonts: boolean
  hasSatoriRenderer: boolean
  convertedWoff2Files: Set<string>
  fontSubsets?: string[]
  fontRequirements: FontRequirementsState
  tw4FontVars: Record<string, string>
  logger: ConsolaInstance
  /** Absolute path to bundled _og-fonts directory for direct filesystem reads during prerender */
  ogFontsDir?: string
}): Promise<ParsedFont[]> {
  const { nuxt, hasNuxtFonts, hasSatoriRenderer, convertedWoff2Files, fontSubsets, fontRequirements, tw4FontVars, logger, ogFontsDir } = options
  const staticInterFonts = getStaticInterFonts(ogFontsDir)

  // 1. Extract fonts from @nuxt/fonts global CSS (WOFF2 paths included for all renderers)
  const allFonts = hasNuxtFonts
    ? await parseFontsFromTemplate(nuxt, { convertedWoff2Files, fontSubsets })
    : []

  // 2. Satori-only: resolve missing font families via fontless
  // Takumi/browser can use WOFF2 and variable fonts directly
  // Skip when @nuxt/fonts is not installed — fontless can't resolve system/fallback fonts
  // from TW4 font stacks (e.g. Menlo, Apple Color Emoji), just use bundled Inter instead
  if (hasSatoriRenderer && hasNuxtFonts) {
    const coveredFamilies = new Set(allFonts.map(f => f.family))
    let missingFamilies: string[] = []

    if (fontRequirements.families.length > 0) {
      missingFamilies = fontRequirements.families.filter(f => !coveredFamilies.has(f))
    }
    else {
      const defaultVar = tw4FontVars['font-sans']
      if (defaultVar)
        missingFamilies = extractCustomFontFamilies(defaultVar).filter(f => !coveredFamilies.has(f))
    }

    if (missingFamilies.length > 0) {
      const additionalFonts = await resolveMissingFontFamilies({
        missingFamilies,
        weights: fontRequirements.weights,
        styles: fontRequirements.styles,
        nuxt,
        logger,
      }).catch((err) => {
        logger.debug('Fontless resolution failed:', err)
        return []
      })
      allFonts.push(...additionalFonts)
    }
  }

  // 3. Apply requirements filtering (all renderers benefit from reduced font payloads)
  const fonts = fontRequirements.isComplete
    ? allFonts.filter(f => matchesFontRequirements(f, fontRequirements))
    : allFonts
  logger.debug(`Resolved ${fonts.length} fonts (from ${allFonts.length} total${fontRequirements.families.length ? `, families: ${fontRequirements.families.join(', ')}` : ''})`)

  // 4. Non-satori renderers: return whatever we have (they handle WOFF2/variable natively)
  if (!hasSatoriRenderer) {
    if (fonts.length === 0 && !hasNuxtFonts)
      return staticInterFonts
    return fonts
  }

  // 5. Satori: need static fonts — fall back to Inter if nothing usable
  if (fonts.length === 0) {
    logger.debug('No fonts available, using static Inter fallback')
    return staticInterFonts
  }

  // 6. Satori: check for variable fonts it can't use
  const satoriFonts = fonts.filter(f => f.satoriSrc)
  if (satoriFonts.length === 0) {
    const variableFamilies = [...new Set(fonts.map(f => f.family))]
    logger.warn(`All fonts are variable fonts (${variableFamilies.join(', ')}). Variable fonts are not supported by Satori renderer. Falling back to bundled Inter font. Consider using the 'takumi' renderer for variable font support.`)
    return [...fonts, ...staticInterFonts]
  }

  return fonts
}
