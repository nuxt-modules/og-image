import type { H3Event } from 'h3'
import type { FontConfig, OgImageRenderEventContext, RuntimeFontConfig } from '../../types'
import { resolve } from '#og-image-virtual/public-assets.mjs'
import { fontRequirements, getComponentFontMap } from '#og-image/font-requirements'
import resolvedFonts from '#og-image/fonts'
import availableFonts from '#og-image/fonts-available'
import { logger } from '../../logger'
import { fontArrayCache, fontCache } from './cache/lru'
import { renameSubsetFonts } from './font-subsets'
import { codepointsIntersectRanges, parseUnicodeRange } from './unicode-range'

export { buildSubsetFamilyChain, renameSubsetFonts, resolveSubsetChain } from './font-subsets'
export { codepointsIntersectRanges, extractCodepoints, parseUnicodeRange } from './unicode-range'

type FontFormat = 'ttf' | 'otf' | 'woff' | 'woff2'

function fontFormat(src: string): FontFormat {
  if (src.endsWith('.woff2'))
    return 'woff2'
  if (src.endsWith('.woff'))
    return 'woff'
  if (src.endsWith('.otf'))
    return 'otf'
  return 'ttf'
}

export interface LoadFontsOptions {
  /**
   * Font formats the renderer can parse.
   * Satori: ttf, otf, woff
   * Takumi: ttf, woff2
   */
  supportedFormats: Set<FontFormat>
  /** Component pascalName — filters fonts to only what this component needs */
  component?: string
  /** When set, ensures this font family is included even if not in requirements */
  fontFamilyOverride?: string
  /** Codepoints present in the template — fonts whose unicodeRange doesn't intersect are skipped */
  codepoints?: Set<number>
}

async function loadFont(event: H3Event, font: FontConfig, src: string): Promise<BufferSource | null> {
  // Include src in cache key to differentiate font subsets (e.g. latin vs cyrillic)
  const cacheKey = `${font.family}-${font.weight}-${font.style}-${src}`
  const cached = fontCache.get(cacheKey)
  if (cached)
    return cached
  const data = await resolve(event, { ...font, src }).catch((err) => {
    logger.warn(`Failed to load font ${font.family}: ${err.message}`)
    return null
  })
  if (!data)
    return null
  fontCache.set(cacheKey, data)
  return data
}

function findClosestWeight(target: number, available: number[]): number {
  return available.reduce((closest, w) =>
    Math.abs(w - target) < Math.abs(closest - target) ? w : closest,
  )
}

/**
 * Select fonts matching requirements with closest-weight fallback.
 * Groups by family and for each required weight picks exact match or closest available.
 */
function selectFontsForRequirements(allFonts: FontConfig[], requirements: typeof fontRequirements): FontConfig[] {
  if (requirements.hasDynamicBindings)
    return [...allFonts]

  // Group style-matched fonts by family, filtering to required families when specified
  const fallbackFonts: FontConfig[] = []
  const byFamily = new Map<string, FontConfig[]>()
  const requiredFamilies = requirements.families.length > 0 ? new Set(requirements.families) : null
  for (const f of allFonts) {
    // Fallback fonts always survive filtering
    if (f.fallback) {
      fallbackFonts.push(f)
      continue
    }
    if (!requirements.styles.includes(f.style as 'normal' | 'italic'))
      continue
    if (requiredFamilies && !requiredFamilies.has(f.family))
      continue
    const arr = byFamily.get(f.family) || []
    arr.push(f)
    byFamily.set(f.family, arr)
  }

  const selected: FontConfig[] = []
  for (const [, familyFonts] of byFamily) {
    const availableWeights = [...new Set(familyFonts.map(f => f.weight))].toSorted((a, b) => a - b)
    if (availableWeights.length === 0)
      continue
    const selectedWeights = new Set<number>()
    for (const w of requirements.weights) {
      if (availableWeights.includes(w)) {
        selectedWeights.add(w)
      }
      else {
        selectedWeights.add(findClosestWeight(w, availableWeights))
      }
    }
    selected.push(...familyFonts.filter(f => selectedWeights.has(f.weight)))
  }
  // Append fallback fonts after selected fonts so they're lowest priority
  selected.push(...fallbackFonts)
  return selected
}

const _warnedFontKeys = new Set<string>()

// Satori uses a WeakMap font cache keyed by array identity — returning the same
// array reference across requests lets satori skip re-parsing font binaries.
// fontArrayCache is imported from ./cache/lru (bounded unstorage LRU, max 20)

export function loadAllFontsDebug(component?: string) {
  const map = getComponentFontMap()
  const componentReqs = component ? (map as Record<string, typeof fontRequirements>)[component] : null
  return {
    component,
    componentReqs: componentReqs ? { families: componentReqs.families, weights: componentReqs.weights, hasDynamicBindings: componentReqs.hasDynamicBindings } : null,
    globalReqs: { families: fontRequirements.families, weights: fontRequirements.weights },
    componentFontMapKeys: Object.keys(map),
    resolvedFontFamilies: [...new Set((resolvedFonts as FontConfig[]).map(f => f.family))],
  }
}

export async function loadAllFonts(event: H3Event, options: LoadFontsOptions): Promise<RuntimeFontConfig[]> {
  const map = getComponentFontMap()
  const componentReqs = options.component ? (map as Record<string, typeof fontRequirements>)[options.component] : null
  const usingGlobalFallback = !!(componentReqs && componentReqs.hasDynamicBindings)
  const reqs = (componentReqs && !componentReqs.hasDynamicBindings) ? componentReqs : fontRequirements
  const fonts = selectFontsForRequirements(resolvedFonts as FontConfig[], reqs)

  // Supplement with override family from available (unfiltered) fonts if not already loaded
  if (options.fontFamilyOverride) {
    const loadedFamilies = new Set(fonts.map(f => f.family))
    if (!loadedFamilies.has(options.fontFamilyOverride)) {
      // Check unfiltered @nuxt/fonts first, then fall back to resolved fonts
      // (which includes bundled Inter when no other fonts are configured)
      const overrideFonts = (availableFonts as FontConfig[]).filter(f => f.family === options.fontFamilyOverride)
      if (overrideFonts.length > 0) {
        fonts.push(...overrideFonts)
      }
      else {
        const resolvedOverride = (resolvedFonts as FontConfig[]).filter(f => f.family === options.fontFamilyOverride)
        fonts.push(...resolvedOverride)
      }
    }
  }

  // Filter out font subsets whose unicodeRange doesn't intersect the template's codepoints
  if (options.codepoints && options.codepoints.size > 0) {
    for (let i = fonts.length - 1; i >= 0; i--) {
      const f = fonts[i]!
      if (!f.unicodeRange)
        continue
      const ranges = parseUnicodeRange(f.unicodeRange)
      if (!ranges)
        continue
      if (!codepointsIntersectRanges(options.codepoints, ranges))
        fonts.splice(i, 1)
    }
  }

  const results = await Promise.all(
    fonts.map(async (f) => {
      let src = f.src
      const srcFormat = fontFormat(f.src)

      // If the primary src format isn't supported, try satoriSrc as alternative
      if (!options.supportedFormats.has(srcFormat)) {
        if (f.satoriSrc && options.supportedFormats.has(fontFormat(f.satoriSrc))) {
          src = f.satoriSrc
        }
        else {
          // No usable format available, skip this font
          return null
        }
      }

      let data = await loadFont(event, f, src)
      // When satoriSrc fails to load (e.g. 404), try original src if its format is supported
      if (!data && src !== f.src && options.supportedFormats.has(srcFormat)) {
        data = await loadFont(event, f, f.src)
        if (data)
          src = f.src
      }
      if (!data)
        return null
      return {
        ...f,
        cacheKey: `${f.family}-${f.weight}-${f.style}-${src}`,
        data,
      } satisfies RuntimeFontConfig
    }),
  )
  const loaded = results.filter((f): f is RuntimeFontConfig => f !== null)

  // Return a stable array reference so satori's WeakMap font cache hits
  const fingerprint = loaded.map(f => f.cacheKey).sort().join('|')
  const cachedArray = fontArrayCache.get(fingerprint)
  if (cachedArray)
    return cachedArray
  fontArrayCache.set(fingerprint, loaded)

  // Skip warnings for bundled community templates — users can't control their font usage
  const isCommunity = options.component && (map as Record<string, any>)[options.component]?.category === 'community'

  // Warn when rendering with Satori and only variable fonts are available (deduplicated)
  if (!options.supportedFormats.has('woff2') && loaded.length === 0 && fonts.length > 0 && !isCommunity) {
    const variableFamilies = [...new Set(fonts.map(f => f.family))]
    const warnKey = `variable-fonts-${variableFamilies.join(',')}`
    if (!_warnedFontKeys.has(warnKey)) {
      if (_warnedFontKeys.size >= 100)
        _warnedFontKeys.clear()
      _warnedFontKeys.add(warnKey)
      logger.warn(`All fonts are variable fonts (${variableFamilies.join(', ')}). Variable fonts are not supported by Satori renderer. Falling back to bundled Inter font. Consider using the 'takumi' renderer for variable font support.`)
    }
  }
  if (import.meta.dev && reqs.weights.length > 0 && !isCommunity) {
    const families = reqs.families.length > 0 ? reqs.families : [...new Set(loaded.map(f => f.family))]
    const component = options.component ? ` (${options.component})` : ''
    const fallbackNote = usingGlobalFallback ? ' Note: using global font requirements because this component has dynamic font bindings.' : ''
    for (const family of families) {
      const loadedWeights = [...new Set(loaded.filter(f => f.family === family).map(f => f.weight))].toSorted((a, b) => a - b)
      if (loadedWeights.length === 0)
        continue
      for (const reqWeight of reqs.weights) {
        if (loadedWeights.includes(reqWeight))
          continue
        const closest = findClosestWeight(reqWeight, loadedWeights)
        const warnKey = `${family}-${reqWeight}-${closest}-${options.component || ''}`
        if (_warnedFontKeys.has(warnKey))
          continue
        if (_warnedFontKeys.size >= 100)
          _warnedFontKeys.clear()
        _warnedFontKeys.add(warnKey)
        logger.warn(`Font "${family}" weight ${reqWeight} not configured${component}, using ${closest} instead.${fallbackNote}`)
      }
    }
  }

  return loaded
}

/**
 * Load additional fonts specified via defineOgImage({ fonts: [...] }).
 * Only object format ({ name, weight, path }) with a path is supported.
 */
export async function loadDefinedFonts(event: OgImageRenderEventContext, fontDefs: any[]): Promise<RuntimeFontConfig[]> {
  const results: RuntimeFontConfig[] = []
  for (const def of fontDefs) {
    if (!def || typeof def !== 'object' || !def.path)
      continue

    const name: string = def.name
    const weight: number = def.weight || 400
    const style: 'normal' | 'italic' = def.style === 'italic' ? 'italic' : 'normal'
    const path: string = def.path

    const fontConfig = { family: name, weight, style, src: path, localPath: path } satisfies FontConfig
    const data = await resolve(event.e, fontConfig).catch(() => null)
    if (data) {
      results.push({
        ...fontConfig,
        cacheKey: `custom-${name}-${weight}-${style}-${path}`,
        data,
      } satisfies RuntimeFontConfig)
    }
  }
  return results
}

export interface LoadFontsForRendererOptions extends LoadFontsOptions {
  /** Custom font definitions from defineOgImage({ fonts: [...] }) — satori only */
  fontDefs?: any[]
}

/**
 * Shared font loading sequence used by both renderers.
 * Loads base fonts via loadAllFonts, then appends any custom font definitions.
 *
 * When a font family has multiple unicode-range subsets loaded (e.g., CJK fonts
 * split into many small chunks), renames each subset to a unique family name
 * (e.g., "Noto Sans SC__0", "Noto Sans SC__1") so renderers use font-family
 * fallback chains for per-character glyph coverage. Without this, both Satori
 * and Takumi pick the first font file and show .notdef for characters in other subsets.
 */
export async function loadFontsForRenderer(event: OgImageRenderEventContext, options: LoadFontsForRendererOptions): Promise<RuntimeFontConfig[]> {
  const baseFonts = await loadAllFonts(event.e, options)
  const customFonts = Array.isArray(options.fontDefs) && options.fontDefs.length > 0
    ? await loadDefinedFonts(event, options.fontDefs)
    : []
  const allFonts = customFonts.length > 0 ? [...baseFonts, ...customFonts] : baseFonts
  return renameSubsetFonts(allFonts)
}

/** Get the default font family override from options or first resolved font */
export function getDefaultFontFamily(options: { props?: Record<string, any> }): { fontFamilyOverride: string | undefined, defaultFont: string | undefined } {
  const fontFamilyOverride = (options.props as Record<string, any>)?.fontFamily
  const defaultFont = (resolvedFonts as FontConfig[])[0]?.family
  return { fontFamilyOverride, defaultFont }
}
