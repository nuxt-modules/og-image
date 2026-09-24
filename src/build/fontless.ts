/**
 * Fontless/unifont integration for static font resolution.
 *
 * Satori can't handle WOFF2 or variable fonts — this module uses fontless
 * (backed by unifont providers: Fontsource, Google, Bunny) to download
 * static TTF/WOFF alternatives.
 *
 * `fontless` and `unifont` are optional peer dependencies.
 */

import type { ConsolaInstance } from 'consola'
import type { FontFamilyProviderOverride, FontlessOptions, Resolver } from 'fontless'
import type { Nuxt } from 'nuxt/schema'
import type { InstancerResult } from './font-instancer'
import type { FontProcessingState, FontRequirementsState, ParsedFont } from './fonts'
import * as fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isAbsolute, join } from 'pathe'
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs-lite'
import { RE_WHITESPACE } from '../util'
import { extractCustomFontFamilies } from './css/css-utils'
import { loadFontInstancer } from './font-instancer'
import { downloadFontFile, extractSubsetNames, fontKey, FONTS_URL_PREFIX, getResolvedNuxtFonts, getStaticFontCacheDir, getStaticInterFonts, matchesFontRequirements, parseAppCssFontFaces, parseConfiguredLocalFonts, satoriSourceKey, STATIC_FONTS_PREFIX } from './fonts'

const RE_NON_ALPHANUMERIC = /[^a-z0-9]/gi

// ============================================================================
// Types
// ============================================================================

interface ProcessFontsOptions {
  nuxt: Nuxt
  logger: ConsolaInstance
  fontRequirements: FontRequirementsState
  fontState: FontProcessingState
  nuxtFontsContext?: NuxtFontsAssetContext | null
  fontSubsets?: string[]
  /** Warn when no static fallback is available. Satori requires one; Takumi can use WOFF2. */
  warnOnMissingStaticFonts?: boolean
  /** HarfBuzz, which turns variable fonts into static ones for Satori. Found from the project by default. */
  loadInstancer?: () => Promise<InstancerResult>
}

/** Reads the files `@nuxt/fonts` serves, from the `fonts:resolved` hook. */
export interface NuxtFontsAssetContext {
  /** The bytes of a font `@nuxt/fonts` serves, by URL; `undefined` for any other file. */
  readFont: (url: string) => Promise<Buffer | undefined>
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

type Glyphs = string | string[] | undefined

interface NuxtFontsGlyphOptions {
  defaults?: { glyphs?: Glyphs }
  families?: Array<{ name?: unknown, glyphs?: Glyphs }>
}

/**
 * `@nuxt/fonts` v1 subsets a family to `glyphs`, and Google applies it server side, so neither
 * the served file nor its source can render arbitrary OG text. Mirrors fontless: a truthy
 * family value wins, otherwise `defaults.glyphs` applies.
 */
export function isGlyphSubsetFamily(fonts: NuxtFontsGlyphOptions | undefined, family: string): boolean {
  const config = fonts?.families?.find(f => typeof f.name === 'string' && f.name.toLowerCase() === family.toLowerCase())
  const glyphs = config?.glyphs || fonts?.defaults?.glyphs
  return !!glyphs?.length
}

function isConfiguredLocalFontFamily(nuxt: Nuxt, family: string): boolean {
  const config = getNuxtFontsFamilyConfig(nuxt, family)
  return !!config && config.global === true && (config.provider === 'local' || typeof config.src === 'string')
}

function getFamilyRequirements(fontRequirements: FontRequirementsState, family: string): {
  weights: number[]
  styles: Array<'normal' | 'italic'>
} {
  const familyName = family.toLowerCase()
  const matchingComponents = Object.values(fontRequirements.componentMap)
    .filter(component => component.families.some(candidate => candidate.toLowerCase() === familyName))

  if (matchingComponents.length === 0 || matchingComponents.some(component => component.hasDynamicBindings)) {
    return {
      weights: fontRequirements.weights,
      styles: fontRequirements.styles,
    }
  }

  return {
    weights: [...new Set(matchingComponents.flatMap(component => component.weights))],
    styles: [...new Set(matchingComponents.flatMap(component => component.styles))],
  }
}

/**
 * The weights to build the font list for. Without component analysis (webpack, rspack), a
 * variable face stands for its regular and bold weights, as in `getResolvedWeights`.
 */
function getListWeights(fontRequirements: FontRequirementsState): number[] {
  return fontRequirements.scanned === false
    ? [...new Set([...fontRequirements.weights, 400, 700])].toSorted((a, b) => a - b)
    : fontRequirements.weights
}

/**
 * Every weight and style @nuxt/fonts resolved for a family, for builds that never analyse OG
 * components (webpack, rspack). A variable face stands for its regular and bold weights.
 */
function getResolvedWeights(fonts: ParsedFont[], family: string): ReturnType<typeof getFamilyRequirements> {
  const faces = fonts.filter(font => font.family === family)
  const weights = new Set(faces.flatMap(font => font.weightRange
    ? [400, 700].filter(weight => font.weightRange![0] <= weight && weight <= font.weightRange![1])
    : [font.weight]))
  return {
    weights: [...weights].toSorted((a, b) => a - b),
    styles: [...new Set(faces.map(font => font.style as 'normal' | 'italic'))],
  }
}

async function initFontless(options: {
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

  // Each fontless version owns its map values: URLs in 0.2, metadata in 0.4.
  const renderedFontURLs: Parameters<typeof normalizeFontData>[0]['renderedFontURLs'] = new Map()

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
        // Static fallbacks must use formats supported by both renderers.
        formats: ['woff', 'ttf'],
      },
    },
    providers,
  })

  options.logger?.debug(`fontless initialized with formats: ['woff', 'ttf'], subsets: ${JSON.stringify(options.fontSubsets || ['latin'])}, priority: ${JSON.stringify(nuxtFontsConfig?.priority || ['google', 'bunny', 'fontsource'])}`)

  ;(options.nuxt as any)._ogImageFontless = { resolver, providerNames: priority } satisfies FontlessContext
}

// ============================================================================
// Font URL Persistence
// ============================================================================

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
  warnOnMissingStaticFonts?: boolean
}): Promise<DownloadedFont[]> {
  if (options.families.length === 0)
    return []

  const staticFontDir = getStaticFontCacheDir(options.nuxt.options.buildDir)
  fs.mkdirSync(staticFontDir, { recursive: true })

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
      staticFontDir,
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
        const filePath = join(staticFontDir, r.filename)
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
          staticFontDir,
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
            const filePath = join(staticFontDir, r.filename)
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
      // deleted above. Leaving fallbackMap empty means satoriSrc won't be set,
      // so Satori skips this family naturally and Inter fallback takes over.
      if (!resolved)
        options.logger.debug(`${family}: no static font alternative found from any provider`)
    }
    else {
      results.push(...familyResults)
    }
  }

  if (options.warnOnMissingStaticFonts !== false && unresolvedFamilies.length > 0) {
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
          `  "${family}" is in fonts.families, but it is not global and no site CSS uses it, so @nuxt/fonts did not resolve it.`,
          `  Set global: true, e.g. fonts: { families: [{ name: '${family}', provider: 'local', weights: [400, 700], global: true }] }.`,
        )
      }
      else if (configuredFamily) {
        lines.push(
          `  "${family}" has global: true, but @nuxt/fonts did not resolve it.`,
          `  Check that the configured provider/src, weights, styles, and file names match the available font files.`,
        )
        if (local)
          lines.push(`  Found ${local.matches.length} matching file(s) under public/fonts/ (e.g. ${local.matches.slice(0, 2).join(', ')}).`)
      }
      else if (local) {
        lines.push(
          `  Found ${local.matches.length} matching file(s) under public/fonts/ (e.g. ${local.matches.slice(0, 2).join(', ')}), but @nuxt/fonts did not resolve "${family}".`,
          `  @nuxt/fonts does not scan Tailwind v4 @theme variables. OG images only use fonts that @nuxt/fonts resolves.`,
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
  staticFontDir: string
  resolver: FontlessContext['resolver']
  logger: ConsolaInstance
  provider?: string
}): Promise<(DownloadedFont & { url: string })[]> {
  const { family, weights, styles, staticFontDir, logger } = options
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
          const destPath = join(staticFontDir, filename)
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
// WOFF2 Preparation (Satori Compat)
// ============================================================================

type FontAssetResult
  = | { _tag: 'Ok', data: Uint8Array }
    | { _tag: 'Err', reason: string }

function hasOpenTypeTable(data: Uint8Array, expectedTag: string): boolean {
  if (data.byteLength < 12)
    return false

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const tableCount = view.getUint16(4)
  for (let index = 0; index < tableCount; index++) {
    const offset = 12 + index * 16
    if (offset + 4 > data.byteLength)
      return false
    const tag = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    )
    if (tag === expectedTag)
      return true
  }
  return false
}

async function readLocalFontAsset(nuxt: Nuxt, source: string): Promise<FontAssetResult> {
  if (source.startsWith('/')) {
    const configuredPublicDir = nuxt.options.dir.public || 'public'
    const publicDir = isAbsolute(configuredPublicDir)
      ? configuredPublicDir
      : join(nuxt.options.srcDir, configuredPublicDir)
    const path = join(publicDir, source.slice(1).split(/[?#]/, 1)[0]!)
    return fs.promises.readFile(path)
      .then(data => ({ _tag: 'Ok' as const, data }))
      .catch((error: NodeJS.ErrnoException) => ({
        _tag: 'Err' as const,
        reason: error.code === 'ENOENT' ? `local source not found: ${path}` : error.message,
      }))
  }

  if (source.startsWith('file:')) {
    const path = fileURLToPath(source)
    return fs.promises.readFile(path)
      .then(data => ({ _tag: 'Ok' as const, data }))
      .catch((error: Error) => ({ _tag: 'Err' as const, reason: error.message }))
  }

  return fetch(source)
    .then(async response => response.ok
      ? { _tag: 'Ok' as const, data: new Uint8Array(await response.arrayBuffer()) }
      : { _tag: 'Err' as const, reason: `source returned HTTP ${response.status}` })
    .catch((error: Error) => ({ _tag: 'Err' as const, reason: error.message }))
}

/** Whether a face renders `weight`: its own weight, or any weight in its variable range. */
function coversWeight(font: ParsedFont, weight: number): boolean {
  return font.weightRange
    ? font.weightRange[0] <= weight && weight <= font.weightRange[1]
    : font.weight === weight
}

const WOFF2_SIGNATURE = 0x774F4632
const SFNT_SIGNATURES = new Set([0x00010000, 0x4F54544F, 0x74727565])

/**
 * Turn the @nuxt/fonts files Satori needs into static TTFs, one per source and weight. WOFF2 is
 * decoded, and a variable font is pinned to each weight with HarfBuzz. A static TTF, OTF or WOFF
 * file needs nothing: Satori reads it as served.
 *
 * Returns the sources that are variable, and the families HarfBuzz was missing for.
 */
async function convertNuxtFontSources(options: {
  sources: Map<string, { font: ParsedFont, weights: number[] }>
  nuxt: Nuxt
  context?: NuxtFontsAssetContext | null
  fontState: FontProcessingState
  logger: ConsolaInstance
  loadInstancer: () => Promise<InstancerResult>
}): Promise<{ variableSources: Set<string>, withoutInstancer: Set<string> }> {
  const staticFontDir = getStaticFontCacheDir(options.nuxt.options.buildDir)
  fs.mkdirSync(staticFontDir, { recursive: true })
  const variableSources = new Set<string>()
  const withoutInstancer = new Set<string>()

  // Keep the decoder and HarfBuzz out of the main module chunk for apps that do not need them.
  let decoder: typeof import('./woff2/decode') | undefined
  let instancer: InstancerResult | undefined

  for (const [fontSrc, { font, weights }] of options.sources) {
    const served: FontAssetResult | undefined = await options.context?.readFont(fontSrc)
      .then(data => data && { _tag: 'Ok' as const, data })
      .catch((error: Error) => ({ _tag: 'Err' as const, reason: error.message }))
    const asset: FontAssetResult = served
      || (isConfiguredLocalFontFamily(options.nuxt, font.family)
        ? await readLocalFontAsset(options.nuxt, fontSrc)
        : { _tag: 'Err', reason: 'not served by Nuxt Fonts' })
    if (asset._tag === 'Err') {
      options.logger.debug(`Could not read Nuxt Fonts asset ${fontSrc}: ${asset.reason}`)
      continue
    }

    const signature = asset.data.byteLength >= 4
      ? new DataView(asset.data.buffer, asset.data.byteOffset, 4).getUint32(0)
      : 0
    const isWoff2 = signature === WOFF2_SIGNATURE
    if (!isWoff2 && !SFNT_SIGNATURES.has(signature))
      continue
    decoder ||= isWoff2 ? await import('./woff2/decode') : decoder
    const sfnt = isWoff2
      ? await Promise.resolve().then(() => decoder!.woff2Decode(asset.data)).catch((error: Error) => {
          options.logger.warn(`Failed to decode Nuxt Fonts asset ${fontSrc}: ${error.message}`)
          return null
        })
      : asset.data
    if (!sfnt)
      continue

    const baseName = fontSrc.split('/').pop()!.replace(/\.(?:woff2|ttf|otf)$/i, '')
    if (!hasOpenTypeTable(sfnt, 'fvar')) {
      if (!isWoff2)
        continue
      const filename = `${baseName}.ttf`
      await fs.promises.writeFile(join(staticFontDir, filename), sfnt)
      for (const weight of weights)
        options.fontState.sourceMap.set(satoriSourceKey(fontSrc, weight), `${STATIC_FONTS_PREFIX}/${filename}`)
      continue
    }

    variableSources.add(fontSrc)
    instancer ||= await options.loadInstancer()
    if (instancer._tag === 'Missing') {
      withoutInstancer.add(font.family)
      continue
    }
    for (const weight of weights) {
      const result = instancer.instancer.instance(sfnt, weight)
      if (result._tag === 'Err') {
        options.logger.warn(`Could not make a static ${font.family} ${weight} font for Satori from ${fontSrc}: ${result.reason}`)
        continue
      }
      const filename = `${baseName}-${weight}.ttf`
      await fs.promises.writeFile(join(staticFontDir, filename), result.data)
      options.fontState.sourceMap.set(satoriSourceKey(fontSrc, weight), `${STATIC_FONTS_PREFIX}/${filename}`)
    }
  }

  if (options.fontState.sourceMap.size > 0)
    options.logger.debug(`Prepared ${options.fontState.sourceMap.size} static Nuxt Fonts files for Satori`)
  return { variableSources, withoutInstancer }
}

/**
 * Prepare @nuxt/fonts files for Satori, which reads neither WOFF2 nor variable fonts. Each file
 * is converted to a static TTF per weight, keeping every subset the site serves. Providers are
 * asked for static files only for weights @nuxt/fonts does not serve, or when a file cannot be
 * converted.
 */
export async function prepareWoff2Fonts(options: ProcessFontsOptions): Promise<void> {
  const { nuxt, logger, fontRequirements, fontState, nuxtFontsContext, fontSubsets, warnOnMissingStaticFonts = true } = options
  const loadInstancer = options.loadInstancer
    || (() => loadFontInstancer([pathToFileURL(`${nuxt.options.rootDir}/`), import.meta.url]))
  const parsedFonts = await getResolvedNuxtFonts(nuxt, { fontState })
  const requirementsByFamily = new Map<string, ReturnType<typeof getFamilyRequirements>>()
  for (const font of parsedFonts) {
    if (!requirementsByFamily.has(font.family)) {
      requirementsByFamily.set(font.family, fontRequirements.scanned === false
        ? getResolvedWeights(parsedFonts, font.family)
        : getFamilyRequirements(fontRequirements, font.family))
    }
  }
  const hasNonWoff2 = new Set(
    parsedFonts
      .filter(f => !f.src.endsWith('.woff2'))
      .map(f => fontKey(f)),
  )

  // Every face Satori may render, with the weights it renders it at
  const faces = parsedFonts
    .filter(font => !(font.src.endsWith('.woff2') && hasNonWoff2.has(fontKey(font))))
    .filter(font => requirementsByFamily.get(font.family)!.styles.includes(font.style as 'normal' | 'italic'))
    .map(font => ({ font, weights: requirementsByFamily.get(font.family)!.weights.filter(weight => coversWeight(font, weight)) }))
    .filter(face => face.weights.length > 0)
  if (faces.length === 0) {
    logger.debug('No Nuxt Fonts files to prepare for Satori')
    return
  }
  const sources = new Map<string, { font: ParsedFont, weights: number[] }>()
  for (const { font, weights } of faces) {
    const source = sources.get(font.src)
    sources.set(font.src, { font, weights: [...new Set([...(source?.weights || []), ...weights])] })
  }

  const { variableSources, withoutInstancer } = await convertNuxtFontSources({
    sources,
    nuxt,
    context: nuxtFontsContext,
    fontState,
    logger,
    loadInstancer,
  })

  if (warnOnMissingStaticFonts && withoutInstancer.size > 0)
    logger.warn(`Satori cannot read variable fonts, and harfbuzzjs was not found to convert ${[...withoutInstancer].join(', ')}. It comes with satori 0.33 and later. Until then, OG images use static files from the font providers.`)

  // Whether Satori can render a family at a weight: every face covering it has a Satori file
  const hasSatoriFile = (font: ParsedFont, weight: number) => fontState.sourceMap.has(satoriSourceKey(font.src, weight))
    || (!font.src.endsWith('.woff2') && !variableSources.has(font.src))
  const isAvailable = (family: string, weight: number, style: string) => {
    const covering = faces.filter(({ font }) => font.family === family && font.style === style && coversWeight(font, weight))
    return covering.length > 0 && covering.every(({ font }) => hasSatoriFile(font, weight))
  }
  const needsConversion = faces
    .map(({ font }) => font)
    .filter(font => font.src.endsWith('.woff2') || variableSources.has(font.src))

  const configuredLocalFamilies = new Set(
    needsConversion
      .filter(font => isConfiguredLocalFontFamily(nuxt, font.family))
      .map(font => font.family),
  )
  const unresolvedLocalFamilies = new Set(
    faces
      .filter(({ font, weights }) => configuredLocalFamilies.has(font.family) && !withoutInstancer.has(font.family)
        && weights.some(weight => !hasSatoriFile(font, weight)))
      .map(({ font }) => font.family),
  )
  if (warnOnMissingStaticFonts) {
    for (const family of unresolvedLocalFamilies)
      logger.warn(`Configured Nuxt Fonts assets for "${family}" could not be converted for Satori. Satori does not support WOFF2 or variable fonts; use static WOFF/TTF sources or the Takumi renderer.`)
  }

  const fallbackRequests = new Map<string, { family: string, weights: Set<number>, style: 'normal' | 'italic' }>()
  for (const font of needsConversion) {
    if (configuredLocalFamilies.has(font.family))
      continue
    const style = font.style as 'normal' | 'italic'
    const requirements = requirementsByFamily.get(font.family)!
    const key = `${font.family}\0${style}`
    const request = fallbackRequests.get(key) || { family: font.family, weights: new Set<number>(), style }
    for (const weight of requirements.weights) {
      if (!isAvailable(font.family, weight, style))
        request.weights.add(weight)
    }
    fallbackRequests.set(key, request)
  }

  const families = Array.from(fallbackRequests.values(), ({ family, weights, style }) => ({
    family,
    weights: [...weights],
    styles: [style],
  })).filter(family => family.weights.length > 0)
  if (families.length === 0)
    return

  logger.debug(`Resolving static font fallbacks for: ${families.map(f => f.family).join(', ')}`)
  // Every family here came from @nuxt/fonts, so a provider without a file only lacks that
  // weight (Lobster ships 400 alone); the unknown-family warning would mislead
  const downloaded = await downloadStaticFonts({
    families,
    nuxt,
    logger,
    fontSubsets,
    warnOnMissingStaticFonts: false,
  }).catch((error: Error) => {
    logger.debug('fontless resolution failed:', error)
    return []
  })

  for (const font of downloaded) {
    const key = `${font.family}-${font.weight}-${font.style}`
    fontState.fallbackMap.set(key, `${STATIC_FONTS_PREFIX}/${font.filename}`)
  }

  if (warnOnMissingStaticFonts) {
    const usableFamilies = new Set([
      ...faces.filter(({ font, weights }) => weights.some(weight => hasSatoriFile(font, weight))).map(({ font }) => font.family),
      ...downloaded.map(font => font.family),
    ])
    for (const family of new Set(families.map(f => f.family))) {
      if (!usableFamilies.has(family))
        logger.warn(`Satori cannot use the Nuxt Fonts files for "${family}", and no provider has static files for it. Satori renders "${family}" text with the bundled Inter font. Use the Takumi renderer for WOFF2 and variable fonts.`)
    }
  }

  if (fontState.fallbackMap.size > 0)
    logger.debug(`Resolved ${fontState.fallbackMap.size} static font fallbacks via fontless`)
  else if (warnOnMissingStaticFonts && fontState.sourceMap.size === 0)
    logger.warn(`No static fonts available for Satori. Falling back to bundled Inter font. Consider using the Takumi renderer for variable font support.`)
}

// ============================================================================
// Missing Font Family Resolution
// ============================================================================

/**
 * Resolve font families that @nuxt/fonts did not resolve.
 * Downloads static font files via fontless (Fontsource, Google, Bunny).
 */
async function resolveMissingFontFamilies(options: {
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
  fontState: FontProcessingState
  fontSubsets?: string[]
  fontRequirements: FontRequirementsState
  tw4FontVars: Record<string, string>
  logger: ConsolaInstance
  /** Absolute path to bundled _og-fonts directory for direct filesystem reads during prerender */
  ogFontsDir?: string
}): Promise<ParsedFont[]> {
  const { nuxt, hasNuxtFonts, hasSatoriRenderer, hasTakumiRenderer, fontState, fontSubsets, fontRequirements, tw4FontVars, logger, ogFontsDir } = options
  const staticInterFonts = getStaticInterFonts(ogFontsDir)

  // 1. Fonts @nuxt/fonts resolved (WOFF2 paths included for all renderers)
  const allFonts = hasNuxtFonts
    ? await getResolvedNuxtFonts(nuxt, { fontState, requiredWeights: getListWeights(fontRequirements) })
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
  // Skip when @nuxt/fonts is not installed — fontless can't resolve system/fallback fonts
  // from TW4 font stacks (e.g. Menlo, Apple Color Emoji), just use bundled Inter instead
  if ((hasSatoriRenderer || hasTakumiRenderer) && hasNuxtFonts) {
    // Families subset to `glyphs` only hold the site's characters; OG text is arbitrary.
    // Re-resolve them in full, and keep the subset faces only if that fails.
    const nuxtFontsOptions = (nuxt.options as { fonts?: NuxtFontsGlyphOptions }).fonts
    const glyphSubsetFamilies = [...new Set(allFonts.map(f => f.family))]
      .filter(family => isGlyphSubsetFamily(nuxtFontsOptions, family))
    const glyphSubsetFaces = allFonts.filter(f => glyphSubsetFamilies.includes(f.family))
    if (glyphSubsetFaces.length > 0)
      allFonts.splice(0, allFonts.length, ...allFonts.filter(f => !glyphSubsetFaces.includes(f)))

    const coveredFamilies = new Set(allFonts.map(f => f.family))
    let missingFamilies: string[] = []

    // Skip fontaine-generated metric fallbacks ("<Family> fallback") — they're
    // local() metric shims for CLS, not real downloadable fonts.
    const isFontaineFallback = (name: string): boolean => / fallback$/i.test(name)

    if (fontRequirements.families.length > 0) {
      missingFamilies = fontRequirements.families.filter(f => !coveredFamilies.has(f) && !isFontaineFallback(f))
    }
    else {
      const defaultVar = tw4FontVars['font-sans']
      if (defaultVar)
        missingFamilies = extractCustomFontFamilies(defaultVar).filter(f => !coveredFamilies.has(f) && !isFontaineFallback(f))
    }
    missingFamilies = [...new Set([...missingFamilies, ...glyphSubsetFamilies])]

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

    const resolvedFamilies = new Set(allFonts.map(f => f.family))
    const unresolvedSubsetFaces = glyphSubsetFaces.filter(f => !resolvedFamilies.has(f.family))
    if (unresolvedSubsetFaces.length > 0) {
      logger.warn(`Could not resolve ${[...new Set(unresolvedSubsetFaces.map(f => f.family))].join(', ')} without \`glyphs\` subsetting. OG images may miss characters outside the configured glyphs.`)
      allFonts.push(...unresolvedSubsetFaces)
    }
  }

  // 3. Apply requirements filtering (all renderers benefit from reduced font payloads)
  // Only filter by weight/style for @nuxt/fonts fonts — they're user-configured and should
  // always be included. The family filter only applies to fontless-resolved fonts (step 2)
  // since fontRequirements.families may only contain system/emoji font names from TW4 vars,
  // not the actual @nuxt/fonts families (e.g. Inter).
  const nuxtFontFamilies = new Set(
    hasNuxtFonts
      ? (await getResolvedNuxtFonts(nuxt, { fontState, requiredWeights: getListWeights(fontRequirements) })).map(f => f.family)
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
  // fail to load at runtime (e.g. an unavailable Nuxt Fonts asset or satoriSrc),
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
