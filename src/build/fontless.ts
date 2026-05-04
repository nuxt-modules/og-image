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
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs-lite'
import { RE_WHITESPACE } from '../util'
import { extractCustomFontFamilies } from './css/css-utils'
import { downloadFontFile, extractSubsetNames, fontKey, FONTS_URL_PREFIX, getStaticInterFonts, matchesFontRequirements, parseAppCssFontFaces, parseConfiguredLocalFonts, parseFontsFromTemplate, STATIC_FONTS_PREFIX } from './fonts'

const RE_NON_ALPHANUMERIC = /[^a-z0-9]/gi

// ============================================================================
// Types
// ============================================================================

export interface ProcessFontsOptions {
  nuxt: Nuxt
  logger: ConsolaInstance
  fontRequirements: FontRequirementsState
  convertedWoff2Files: Map<string, string>
  fontSubsets?: string[]
  warnOnMissingStaticFonts?: boolean
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
  /** Providers the resolver will consult, in priority order. Used for diagnostics. */
  providerNames: string[]
}

function getFontlessContext(nuxt: Nuxt): FontlessContext | undefined {
  return (nuxt as any)._ogImageFontless
}

function getNuxtFontsFamilyConfig(nuxt: Nuxt, family: string): Record<string, unknown> | undefined {
  const families = ((nuxt.options as any).fonts as { families?: Array<Record<string, unknown>> } | undefined)?.families
  return families?.find(f => typeof f?.name === 'string' && f.name.toLowerCase() === family.toLowerCase())
}

function isConfiguredLocalFontFamily(nuxt: Nuxt, family: string): boolean {
  const config = getNuxtFontsFamilyConfig(nuxt, family)
  return !!config && config.global === true && (config.provider === 'local' || typeof config.src === 'string')
}

export async function initFontless(options: {
  nuxt: Nuxt
  logger?: ConsolaInstance
  fontSubsets?: string[]
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

  // Persistent cache avoids re-fetching from Google/Bunny/Fontsource on every dev restart
  const storage = createStorage({
    driver: fsDriver({ base: join(options.nuxt.options.rootDir, 'node_modules/.cache/nuxt-og-image/unifont') }),
  })

  // Filter fontless's generic "Could not produce font face declaration" warnings —
  // og-image emits its own actionable warning with provider/family context (see
  // resolveAndDownloadFamily). Other warnings pass through unchanged.
  // consola methods live on the prototype, so a Proxy is the safest way to forward
  // every call while overriding only `warn` for the specific low-signal message.
  const filteredLogger = options.logger
    ? new Proxy(options.logger, {
        get(target, prop, receiver) {
          if (prop === 'warn') {
            return (...args: unknown[]) => {
              const msg = String(args[0] ?? '')
              if (msg.includes('Could not produce font face declaration')) {
                target.debug(msg)
                return
              }
              ;(target.warn as (...a: unknown[]) => unknown)(...args)
            }
          }
          return Reflect.get(target, prop, receiver)
        },
      })
    : undefined

  const priority = nuxtFontsConfig?.priority || ['google', 'bunny', 'fontsource']

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
    logger: filteredLogger,
    storage,
    options: {
      families: userFamilies,
      // Google first — only provider with reliable WOFF format negotiation via user-agent.
      // fontsource/bunny serve WOFF2-only for most fonts, and unifont's cascade stops
      // at the first provider that recognizes the family (even if it returns empty fonts
      // after format filtering), so they must come after Google.
      priority,
      defaults: {
        weights: [400, 700],
        styles: ['normal', 'italic'],
        subsets: options.fontSubsets || ['latin'],
        // Satori/Takumi can't reliably use WOFF2 subsets — request static formats
        formats: ['woff', 'ttf'],
      },
    },
    providers,
  })

  options.logger?.debug(`fontless initialized with formats: ['woff', 'ttf'], subsets: ${JSON.stringify(options.fontSubsets || ['latin'])}, priority: ${JSON.stringify(nuxtFontsConfig?.priority || ['google', 'bunny', 'fontsource'])}`)

  ;(options.nuxt as any)._ogImageFontless = { resolver, renderedFontURLs, providerNames: priority } satisfies FontlessContext
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
 * Resolve which requested weights a font entry covers.
 * For static fonts (weight is a single number), returns that weight if requested.
 * For variable fonts (weight is a range), returns all requested weights within the range.
 */
function resolveWeightsFromFontEntry(fontWeight: unknown, requestedWeights: number[]): number[] {
  if (typeof fontWeight === 'number')
    return requestedWeights.includes(fontWeight) ? [fontWeight] : []
  // Parse range from string "200 900" or array [200, 900]
  let min: number, max: number
  if (Array.isArray(fontWeight) && fontWeight.length >= 2) {
    min = Number(fontWeight[0])
    max = Number(fontWeight[1])
  }
  else if (typeof fontWeight === 'string') {
    const parts = fontWeight.split(RE_WHITESPACE).map(Number)
    if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      min = parts[0]!
      max = parts[1]!
    }
    else {
      const n = Number(fontWeight)
      return (!Number.isNaN(n) && requestedWeights.includes(n)) ? [n] : (requestedWeights.includes(400) ? [400] : [])
    }
  }
  else {
    return requestedWeights.includes(400) ? [400] : []
  }
  return requestedWeights.filter(w => w >= min && w <= max)
}

/**
 * Resolve font families via fontless → download static TTF/WOFF files to disk.
 * Combines resolution and download into a single pipeline.
 */
async function downloadStaticFonts(options: {
  families: { family: string, weights: number[], styles: Array<'normal' | 'italic'> }[]
  nuxt: Nuxt
  logger: ConsolaInstance
  fontSubsets?: string[]
}): Promise<DownloadedFont[]> {
  if (options.families.length === 0)
    return []

  const ttfDir = join(options.nuxt.options.buildDir, 'cache', 'og-image', 'fonts-ttf')
  fs.mkdirSync(ttfDir, { recursive: true })

  await initFontless({ nuxt: options.nuxt, logger: options.logger, fontSubsets: options.fontSubsets })
  const fontlessCtx = getFontlessContext(options.nuxt)
  if (!fontlessCtx) {
    options.logger.warn('fontless not initialized, cannot resolve static font fallbacks')
    return []
  }

  const results: DownloadedFont[] = []
  // Alternative providers for retrying when a provider returns variable font binaries
  // (same URL for multiple weights). Fontsource and Bunny serve per-weight static files.
  const fallbackProviders = ['fontsource', 'bunny']
  const unresolvedFamilies: string[] = []

  for (const { family, weights, styles } of options.families) {
    const familyResults = await resolveAndDownloadFamily({
      family,
      weights,
      styles,
      ttfDir,
      resolver: fontlessCtx.resolver,
      logger: options.logger,
    })

    if (familyResults.length === 0)
      unresolvedFamilies.push(family)

    // Detect variable font binaries: same URL used for multiple weights means the provider
    // returned a variable font file, which Satori can't render at different weights.
    const urlToWeights = new Map<string, number[]>()
    for (const r of familyResults) urlToWeights.set(r.url, [...(urlToWeights.get(r.url) || []), r.weight])
    const hasVariableBinary = [...urlToWeights.values()].some(ws => ws.length > 1)

    if (hasVariableBinary && weights.length > 1) {
      options.logger.debug(`${family}: provider returned variable font binary, retrying with alternative providers`)
      // Delete the variable font files so fallback providers can re-download with static binaries
      for (const r of familyResults) {
        const filePath = join(ttfDir, r.filename)
        if (fs.existsSync(filePath))
          fs.unlinkSync(filePath)
      }
      let resolved = false
      // Try alternative providers that serve per-weight static files
      for (const provider of fallbackProviders) {
        const altResults = await resolveAndDownloadFamily({
          family,
          weights,
          styles,
          ttfDir,
          logger: options.logger,
          resolver: fontlessCtx.resolver,
          provider,
        })
        if (altResults.length === 0)
          continue
        const altUrls = new Map<string, number[]>()
        for (const r of altResults) altUrls.set(r.url, [...(altUrls.get(r.url) || []), r.weight])
        if ([...altUrls.values()].some(ws => ws.length > 1)) {
          // Still variable — clean up before trying next provider
          for (const r of altResults) {
            const filePath = join(ttfDir, r.filename)
            if (fs.existsSync(filePath))
              fs.unlinkSync(filePath)
          }
          continue
        }
        results.push(...altResults)
        resolved = true
        break
      }
      // If no static alternative found, don't push the (deleted) variable font results.
      // Variable fonts crash Satori's opentype.js parser, and the files were already
      // deleted above. Leaving convertedWoff2Files empty means satoriSrc won't be set,
      // so Satori skips this family naturally and Inter fallback takes over.
      if (!resolved)
        options.logger.debug(`${family}: no static font alternative found from any provider`)
    }
    else {
      results.push(...familyResults)
    }
  }

  if (unresolvedFamilies.length > 0) {
    const providerList = fontlessCtx.providerNames.join(', ') || 'none'
    const localFonts = await listLocalPublicFontFiles(options.nuxt).catch(() => [] as string[])
    const matchedLocal = unresolvedFamilies
      .map((family) => {
        const slug = family.toLowerCase().replace(RE_NON_ALPHANUMERIC, '-')
        const matches = localFonts.filter(f => f.toLowerCase().includes(slug))
        return { family, matches }
      })
      .filter(x => x.matches.length > 0)

    for (const family of unresolvedFamilies) {
      const local = matchedLocal.find(m => m.family === family)
      const configuredFamily = getNuxtFontsFamilyConfig(options.nuxt, family)
      const lines = [
        `Could not resolve font "${family}" for OG images.`,
        `  Tried providers: ${providerList}.`,
      ]
      if (configuredFamily && configuredFamily.global !== true) {
        lines.push(
          `  "${family}" is declared in fonts.families, but it is not global so @nuxt/fonts did not emit it in nuxt-fonts-global.css.`,
          `  Set global: true, e.g. fonts: { families: [{ name: '${family}', provider: 'local', weights: [400, 700], global: true }] }.`,
        )
      }
      else if (configuredFamily) {
        lines.push(
          `  "${family}" is declared with global: true, but @nuxt/fonts still did not emit @font-face for it.`,
          `  Check that the configured provider/src, weights, styles, and file names match the available font files.`,
        )
        if (local)
          lines.push(`  Found ${local.matches.length} matching file(s) under public/fonts/ (e.g. ${local.matches.slice(0, 2).join(', ')}).`)
      }
      else if (local) {
        lines.push(
          `  Found ${local.matches.length} matching file(s) under public/fonts/ (e.g. ${local.matches.slice(0, 2).join(', ')}) but @nuxt/fonts did not emit @font-face for "${family}".`,
          `  Tailwind v4 @theme variables are not scanned by @nuxt/fonts, and OG images only read globally emitted font faces.`,
          `  Declare it explicitly with global: true, e.g. fonts: { families: [{ name: '${family}', provider: 'local', weights: [400, 700], global: true }] }.`,
        )
      }
      else {
        lines.push(
          `  Not a known Google/Bunny/Fontsource font, and no matching files under public/fonts/.`,
          `  If this is a custom/local font, add it to nuxt.config with global: true: fonts: { families: [{ name: '${family}', src: '/path/to/font.woff2', global: true }] }.`,
          `  If it should resolve from a remote provider, check the spelling or add the provider to fonts.priority.`,
        )
      }
      options.logger.warn(lines.join('\n'))
    }
  }

  return results
}

/** List font filenames under public/fonts/ for diagnostic suggestions. */
async function listLocalPublicFontFiles(nuxt: Nuxt): Promise<string[]> {
  const dir = join(nuxt.options.rootDir, 'public', 'fonts')
  if (!fs.existsSync(dir))
    return []
  const out: string[] = []
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name)
      if (entry.isDirectory())
        walk(p)
      else if (/\.(?:woff2?|ttf|otf)$/i.test(entry.name))
        out.push(entry.name)
    }
  }
  walk(dir)
  return out
}

/** Resolve and download fonts for a single family. Returns results with URLs for dedup detection. */
async function resolveAndDownloadFamily(options: {
  family: string
  weights: number[]
  styles: Array<'normal' | 'italic'>
  ttfDir: string
  resolver: FontlessContext['resolver']
  logger: ConsolaInstance
  provider?: string
}): Promise<(DownloadedFont & { url: string })[]> {
  const { family, weights, styles, ttfDir, logger } = options
  const results: (DownloadedFont & { url: string })[] = []

  try {
    const override = options.provider
      ? { name: family, weights, styles, provider: options.provider } as FontFamilyProviderOverride
      : { name: family, weights, styles } as FontFamilyProviderOverride
    const resolution = await options.resolver(family, override)
    if (!resolution?.fonts?.length)
      return results

    for (const font of resolution.fonts) {
      const srcs = Array.isArray(font.src) ? font.src : [font.src]
      for (const src of srcs) {
        if (typeof src !== 'object' || !('url' in src))
          continue
        const url = (src as any).originalURL || src.url
        const format = src.format || (url.endsWith('.woff') ? 'woff' : url.endsWith('.ttf') ? 'truetype' : undefined)
        const isTtf = format === 'truetype' || format === 'ttf'
        if (!isTtf && format !== 'woff')
          continue
        const style = font.style || 'normal'
        if (!styles.includes(style as 'normal' | 'italic'))
          continue

        const resolvedWeights = resolveWeightsFromFontEntry(font.weight, weights)
        if (resolvedWeights.length === 0)
          continue

        const ext = isTtf ? 'ttf' : 'woff'
        for (const weight of resolvedWeights) {
          const filename = `${family.replace(RE_NON_ALPHANUMERIC, '_')}-${weight}-${style}.${ext}`
          const destPath = join(ttfDir, filename)
          if (!await downloadFontFile(url, destPath))
            continue

          results.push({ family, weight, style, format, filename, url })
          logger.debug(`Resolved static font: ${family} ${weight}`)
        }
      }
    }
  }
  catch (err) {
    options.logger.debug(`Failed to resolve fallback font for ${family}:`, err)
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
  const { nuxt, logger, fontRequirements, convertedWoff2Files, fontSubsets, warnOnMissingStaticFonts = true } = options

  const parsedFonts = await parseFontsFromTemplate(nuxt, { convertedWoff2Files })

  // Filter to WOFF2 fonts that need processing (no WOFF/TTF alternative available)
  const hasNonWoff2 = new Set(
    parsedFonts
      .filter(f => !f.src.endsWith('.woff2'))
      .map(f => fontKey(f)),
  )

  // Don't filter by family — @nuxt/fonts fonts are explicitly configured by the user
  // and may not appear in fontRequirements.families (which only tracks CSS class usage)
  const woff2Fonts = parsedFonts.filter(f =>
    f.src.endsWith('.woff2')
    && !hasNonWoff2.has(fontKey(f))
    && !isConfiguredLocalFontFamily(nuxt, f.family)
    && fontRequirements.weights.includes(f.weight)
    && fontRequirements.styles.includes(f.style as 'normal' | 'italic'),
  )

  if (woff2Fonts.length === 0) {
    logger.debug('No WOFF2 fonts to process')
    return
  }

  // Group WOFF2 fonts by family, requesting ALL fontRequirements.weights for each family.
  // @nuxt/fonts may serve variable fonts with a single weight entry (e.g. 400), but the
  // underlying font supports a full weight range. By requesting all needed weights from
  // fontless, we get static alternatives for every weight the templates actually use.
  const familyMap = new Map<string, { weights: Set<number>, styles: Set<'normal' | 'italic'> }>()
  for (const font of woff2Fonts) {
    const existing = familyMap.get(font.family) || { weights: new Set(fontRequirements.weights), styles: new Set() }
    existing.styles.add(font.style as 'normal' | 'italic')
    familyMap.set(font.family, existing)
  }

  const families = Array.from(familyMap.entries(), ([family, { weights, styles }]) => ({
    family,
    weights: [...weights],
    styles: [...styles],
  }))

  logger.debug(`Resolving static fonts for: ${families.map(f => f.family).join(', ')}`)

  try {
    const downloaded = await downloadStaticFonts({
      families,
      nuxt,
      logger,
      fontSubsets,
    })

    for (const font of downloaded) {
      const key = `${font.family}-${font.weight}-${font.style}`
      convertedWoff2Files.set(key, `${STATIC_FONTS_PREFIX}/${font.filename}`)
    }

    if (convertedWoff2Files.size > 0) {
      logger.debug(`Resolved ${convertedWoff2Files.size} static font files via fontless`)
    }
    else if (warnOnMissingStaticFonts) {
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
  fontSubsets?: string[]
}): Promise<ParsedFont[]> {
  const { missingFamilies, weights, styles, nuxt, logger, fontSubsets } = options

  const families = missingFamilies.map(family => ({ family, weights, styles }))
  const downloaded = await downloadStaticFonts({ families, nuxt, logger, fontSubsets })

  const results = downloaded.map(f => ({
    family: f.family,
    src: `${STATIC_FONTS_PREFIX}/${f.filename}`,
    weight: f.weight,
    style: f.style,
    satoriSrc: `${STATIC_FONTS_PREFIX}/${f.filename}`,
  }))

  if (results.length > 0)
    logger.debug(`Resolved ${results.length} font files via fontless for: ${missingFamilies.join(', ')}`)

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
  hasTakumiRenderer: boolean
  convertedWoff2Files: Map<string, string>
  fontSubsets?: string[]
  fontRequirements: FontRequirementsState
  tw4FontVars: Record<string, string>
  logger: ConsolaInstance
  /** Absolute path to bundled _og-fonts directory for direct filesystem reads during prerender */
  ogFontsDir?: string
}): Promise<ParsedFont[]> {
  const { nuxt, hasNuxtFonts, hasSatoriRenderer, hasTakumiRenderer, convertedWoff2Files, fontSubsets, fontRequirements, tw4FontVars, logger, ogFontsDir } = options
  const staticInterFonts = getStaticInterFonts(ogFontsDir)

  // 1. Extract fonts from @nuxt/fonts global CSS (WOFF2 paths included for all renderers)
  const allFonts = hasNuxtFonts
    ? await parseFontsFromTemplate(nuxt, { convertedWoff2Files, requiredWeights: fontRequirements.weights })
    : []

  if (hasNuxtFonts) {
    const configuredLocalFonts = parseConfiguredLocalFonts(nuxt)
    if (configuredLocalFonts.length > 0) {
      const existingKeys = new Set(allFonts.map(f => `${f.family}-${f.weight}-${f.style}`))
      for (const font of configuredLocalFonts) {
        const key = `${font.family}-${font.weight}-${font.style}`
        if (!existingKeys.has(key)) {
          allFonts.push(font)
          existingKeys.add(key)
        }
      }
      logger.debug(`Resolved ${configuredLocalFonts.length} configured local font faces from public/fonts`)
    }
  }

  // Auto-detect subsets from @nuxt/fonts CSS comments (e.g. devanagari, cyrillic)
  // so fontless downloads include non-Latin fonts instead of defaulting to latin-only
  const detectedSubsets = extractSubsetNames(allFonts)
  const effectiveSubsets = detectedSubsets.length > 0 ? detectedSubsets : (fontSubsets || ['latin'])

  // 1b. Extract manual @font-face declarations from app CSS files (e.g. main.css)
  const appCssFonts = await parseAppCssFontFaces(nuxt).catch(() => [])
  if (appCssFonts.length > 0) {
    const existingKeys = new Set(allFonts.map(f => fontKey(f)))
    for (const font of appCssFonts) {
      if (!existingKeys.has(fontKey(font))) {
        allFonts.push(font)
        existingKeys.add(fontKey(font))
      }
    }
    logger.debug(`Parsed ${appCssFonts.length} fonts from app CSS @font-face declarations`)
  }

  // 2. Satori/Takumi: resolve missing font families via fontless
  // Takumi needs static fonts to work around WOFF2 subset decompression bugs
  // Skip when @nuxt/fonts is not installed — fontless can't resolve system/fallback fonts
  // from TW4 font stacks (e.g. Menlo, Apple Color Emoji), just use bundled Inter instead
  if ((hasSatoriRenderer || hasTakumiRenderer) && hasNuxtFonts) {
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
        fontSubsets: effectiveSubsets,
      }).catch((err) => {
        logger.debug('Fontless resolution failed:', err)
        return []
      })
      allFonts.push(...additionalFonts)
    }
  }

  // 3. Apply requirements filtering (all renderers benefit from reduced font payloads)
  // Only filter by weight/style for @nuxt/fonts fonts — they're user-configured and should
  // always be included. The family filter only applies to fontless-resolved fonts (step 2)
  // since fontRequirements.families may only contain system/emoji font names from TW4 vars,
  // not the actual @nuxt/fonts families (e.g. Inter).
  const nuxtFontFamilies = new Set(
    hasNuxtFonts
      ? (await parseFontsFromTemplate(nuxt, { convertedWoff2Files, requiredWeights: fontRequirements.weights })).map(f => f.family)
      : [],
  )
  const fonts = !fontRequirements.hasDynamicBindings
    ? allFonts.filter(f =>
        nuxtFontFamilies.has(f.family)
          // Keep all @nuxt/fonts weights — runtime will pick closest match per requirement
          ? fontRequirements.styles.includes(f.style as 'normal' | 'italic')
          : matchesFontRequirements(f, fontRequirements),
      )
    : allFonts
  // Group resolved fonts by family for debug output
  const fontsByFamily = new Map<string, number[]>()
  for (const f of fonts) {
    const weights = fontsByFamily.get(f.family) || []
    weights.push(f.weight)
    fontsByFamily.set(f.family, weights)
  }
  const familyBreakdown = Array.from(fontsByFamily.entries(), ([family, weights]) => `  ${family} → ${[...new Set(weights)].toSorted((a, b) => a - b).join(', ')}`)
    .join('\n')
  logger.debug(`Resolved ${fonts.length} fonts (from ${allFonts.length} total)\n${familyBreakdown}`)

  // 4. Non-satori/non-takumi renderers: return whatever we have (browser handles WOFF2/variable natively)
  if (!hasSatoriRenderer && !hasTakumiRenderer) {
    if (fonts.length === 0 && !hasNuxtFonts)
      return staticInterFonts
    return fonts
  }

  // 5. Always include bundled Inter as a guaranteed last-resort fallback.
  // Static TTF files work with all renderers. Without this, if all user fonts
  // fail to load at runtime (e.g. WOFF2 subset bugs in Takumi, 404 on satoriSrc),
  // text becomes invisible because there's no system font fallback.
  const existingInterKeys = new Set(fonts.filter(f => f.family === 'Inter').map(f => fontKey(f)))
  for (const interFont of staticInterFonts) {
    if (!existingInterKeys.has(fontKey(interFont)))
      fonts.push(interFont)
  }

  if (fonts.length === staticInterFonts.length) {
    logger.debug('No user fonts available, using static Inter fallback only')
  }

  // 6. Satori: warn about variable fonts it can't use
  const satoriFonts = fonts.filter(f => f.satoriSrc)
  if (satoriFonts.length === 0) {
    const variableFamilies = [...new Set(fonts.filter(f => f.family !== 'Inter').map(f => f.family))]
    if (variableFamilies.length > 0)
      logger.debug(`All fonts are variable fonts (${variableFamilies.join(', ')}). Variable fonts are not supported by Satori renderer. Will fall back to bundled Inter font at render time.`)
  }

  return fonts
}
