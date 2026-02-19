import type { H3Event } from 'h3'
import type { FontConfig, RuntimeFontConfig } from '../../types'
import { resolve } from '#og-image-virtual/public-assets.mjs'
import { fontRequirements, getComponentFontMap } from '#og-image/font-requirements'
import resolvedFonts from '#og-image/fonts'
import availableFonts from '#og-image/fonts-available'
import { logger } from '../../logger'
import { fontCache } from './cache/lru'

export interface LoadFontsOptions {
  /**
   * Whether the renderer supports WOFF2.
   * When false, WOFF2 fonts will use satoriSrc (converted TTF) if available,
   * otherwise they will be skipped.
   */
  supportsWoff2: boolean
  /** Component pascalName — filters fonts to only what this component needs */
  component?: string
  /** When set, ensures this font family is included even if not in requirements */
  fontFamilyOverride?: string
}

async function loadFont(event: H3Event, font: FontConfig, src: string): Promise<BufferSource | null> {
  // Include src in cache key to differentiate font subsets (e.g. latin vs cyrillic)
  const cacheKey = `${font.family}-${font.weight}-${font.style}-${src}`
  const cached = await fontCache.getItem(cacheKey)
  if (cached) {
    // Decode base64 back to Buffer
    const data = Buffer.from(cached, 'base64')
    return data
  }
  const data = await resolve(event, { ...font, src }).catch((err) => {
    // Suppress 404 warnings for converted TTF fonts - these are intentionally deleted
    // for variable fonts (which would crash Satori's opentype.js parser)
    const is404OnTtf = src.endsWith('.ttf') && (err.message?.includes('404') || err.message?.includes('not found'))
    if (!is404OnTtf) {
      logger.warn(`Failed to load font ${font.family}: ${err.message}`)
    }
    return null
  })
  if (!data)
    return null
  // Encode as base64 for storage to avoid LRU cache serialization issues
  const base64 = Buffer.from(data as Buffer).toString('base64')
  await fontCache.setItem(cacheKey, base64)
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
  const byFamily = new Map<string, FontConfig[]>()
  const requiredFamilies = requirements.families.length > 0 ? new Set(requirements.families) : null
  for (const f of allFonts) {
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
    const availableWeights = [...new Set(familyFonts.map(f => f.weight))].sort((a, b) => a - b)
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
  return selected
}

const _warnedFontKeys = new Set<string>()

// Satori uses a WeakMap font cache keyed by array identity — returning the same
// array reference across requests lets satori skip re-parsing font binaries.
const _fontArrayCache = new Map<string, RuntimeFontConfig[]>()

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

  const results = await Promise.all(
    fonts.map(async (f) => {
      let src = f.src
      const isWoff2 = f.src.endsWith('.woff2')

      if (!options.supportsWoff2 && isWoff2) {
        // For renderers that don't support WOFF2 (like Satori),
        // use converted TTF if available, otherwise skip this font
        if (f.satoriSrc) {
          src = f.satoriSrc
        }
        else {
          // No converted TTF available, skip WOFF2 font
          return null
        }
      }

      const data = await loadFont(event, f, src)
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
  const cachedArray = _fontArrayCache.get(fingerprint)
  if (cachedArray)
    return cachedArray
  _fontArrayCache.set(fingerprint, loaded)

  // Warn about weight substitutions (deduplicated)
  // Skip warnings for bundled community templates — users can't control their font usage
  const isCommunity = options.component && (map as Record<string, any>)[options.component]?.category === 'community'
  if (import.meta.dev && reqs.weights.length > 0 && !isCommunity) {
    const families = reqs.families.length > 0 ? reqs.families : [...new Set(loaded.map(f => f.family))]
    const component = options.component ? ` (${options.component})` : ''
    const fallbackNote = usingGlobalFallback ? ' Note: using global font requirements because this component has dynamic font bindings.' : ''
    for (const family of families) {
      const loadedWeights = [...new Set(loaded.filter(f => f.family === family).map(f => f.weight))].sort((a, b) => a - b)
      if (loadedWeights.length === 0)
        continue
      for (const reqWeight of reqs.weights) {
        if (loadedWeights.includes(reqWeight))
          continue
        const closest = findClosestWeight(reqWeight, loadedWeights)
        const warnKey = `${family}-${reqWeight}-${closest}-${options.component || ''}`
        if (_warnedFontKeys.has(warnKey))
          continue
        _warnedFontKeys.add(warnKey)
        logger.warn(`Font "${family}" weight ${reqWeight} not configured${component}, using ${closest} instead.${fallbackNote}`)
      }
    }
  }

  return loaded
}
