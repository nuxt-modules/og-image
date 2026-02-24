/**
 * Pure font processing — types, helpers, CSS parsing, and file management.
 * No external font resolution deps (fontless/unifont live in ./fontless.ts).
 */

import type { ConsolaInstance } from 'consola'
import type { Nuxt } from 'nuxt/schema'
import { existsSync } from 'node:fs'
import * as fs from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { extractCustomFontFamilies } from './css/css-utils'
import { extractFontFacesWithSubsets } from './css/font-face'

// ============================================================================
// Types
// ============================================================================

export interface ParsedFont {
  family: string
  src: string
  weight: number
  style: string
  satoriSrc?: string
  unicodeRange?: string
  /** Absolute filesystem path for direct file reads (e.g. bundled fallback fonts). */
  absolutePath?: string
}

/** URL prefix for @nuxt/fonts web fonts (used by fontless normalizeFontData) */
export const FONTS_URL_PREFIX = '/_fonts'

/** URL prefix for Satori-specific static font downloads (separate from @nuxt/fonts to avoid conflicts) */
export const SATORI_FONTS_PREFIX = '/_og-satori-fonts'

export interface FontProcessingState {
  /** Map of font identity (family+weight+style) → fontless-downloaded static font path */
  convertedWoff2Files: Map<string, string>
  /** Whether font processing has completed */
  done: boolean
}

export interface FontRequirementsState {
  weights: number[]
  styles: Array<'normal' | 'italic'>
  /** Resolved font family names. Empty = don't filter by family. */
  families: string[]
  hasDynamicBindings: boolean
  componentMap: Record<string, { weights: number[], styles: Array<'normal' | 'italic'>, families: string[], hasDynamicBindings: boolean, category?: 'app' | 'community' | 'pro' }>
}

// ============================================================================
// Shared Helpers
// ============================================================================

/** Dedup key for a font face: family + weight + style + unicode range. */
export function fontKey(f: { family: string, weight: number, style: string, unicodeRange?: string }): string {
  return `${f.family}-${f.weight}-${f.style}-${f.unicodeRange || 'default'}`
}

/** Check if a font matches the detected weight/style/family requirements. */
export function matchesFontRequirements(
  f: { weight: number, style: string, family: string },
  req: { weights: number[], styles: Array<'normal' | 'italic'>, families: string[] },
): boolean {
  return req.weights.includes(f.weight)
    && req.styles.includes(f.style as 'normal' | 'italic')
    && (req.families.length === 0 || req.families.includes(f.family))
}

// ============================================================================
// Font Family Resolution
// ============================================================================

/**
 * Resolve font family class suffixes and inline names to actual font family names.
 * Uses TW4 font vars to map class names (e.g., 'sans' → --font-sans → 'Inter').
 * Returns empty array if no families detected (meaning: don't filter by family).
 */
export function resolveFontFamilies(
  familyClasses: string[],
  familyNames: string[],
  fontVars: Record<string, string>,
): string[] {
  if (familyClasses.length === 0 && familyNames.length === 0)
    return []

  const families = new Set<string>()

  // Always include the font-sans default — the wrapper div uses it as its font-family,
  // so it must be in the requirements to ensure it gets resolved and loaded.
  const sansValue = fontVars['font-sans']
  if (sansValue) {
    for (const f of extractCustomFontFamilies(sansValue))
      families.add(f)
  }

  // Resolve class suffixes via TW4 vars (e.g., 'serif' → fontVars['font-serif'])
  for (const cls of familyClasses) {
    const varValue = fontVars[`font-${cls}`]
    if (varValue) {
      for (const f of extractCustomFontFamilies(varValue))
        families.add(f)
    }
  }

  // Add directly referenced family names from inline styles
  for (const name of familyNames)
    families.add(name)

  return [...families]
}

// ============================================================================
// Font Parsing from App CSS (@font-face)
// ============================================================================

/**
 * Parse manual @font-face declarations from the app's CSS entry files.
 * These are user-declared local fonts (not managed by @nuxt/fonts).
 * Uses lightningcss with errorRecovery to handle @import/@tailwind directives.
 */
export async function parseAppCssFontFaces(nuxt: Nuxt): Promise<ParsedFont[]> {
  const cssEntries = nuxt.options.css || []
  if (cssEntries.length === 0)
    return []

  const { extractFontFacesSimple } = await import('./css/font-face')
  const results: ParsedFont[] = []
  const seen = new Set<string>()

  for (const entry of cssEntries) {
    const cssPath = typeof entry === 'string' ? entry : (entry as any).src
    if (!cssPath)
      continue

    // Resolve path relative to srcDir
    const resolved = cssPath.startsWith('~/')
      ? join(nuxt.options.srcDir, cssPath.slice(2))
      : cssPath.startsWith('/')
        ? cssPath
        : join(nuxt.options.srcDir, cssPath)

    if (!existsSync(resolved))
      continue

    const content = fs.readFileSync(resolved, 'utf-8')
    // Only parse files that contain @font-face
    if (!content.includes('@font-face'))
      continue

    // Extract only @font-face blocks to avoid lightningcss errors on @import/@tailwind
    const fontFaceBlocks = content.match(/@font-face\s*\{[^}]+\}/g)
    if (!fontFaceBlocks)
      continue

    const fontFaceCss = fontFaceBlocks.join('\n')
    const fonts = await extractFontFacesSimple(fontFaceCss).catch(() => [])

    for (const font of fonts) {
      const key = fontKey({ family: font.family, weight: font.weight, style: font.style })
      if (seen.has(key))
        continue
      seen.add(key)

      // TTF/WOFF sources can be used directly by Satori (no conversion needed)
      const satoriSrc = font.isWoff2 ? undefined : font.src
      results.push({
        family: font.family,
        src: font.src,
        weight: font.weight,
        style: font.style,
        satoriSrc,
        unicodeRange: font.unicodeRange,
      })
    }
  }

  return results
}

// ============================================================================
// Font Parsing from @nuxt/fonts
// ============================================================================

/**
 * Parse fonts from @nuxt/fonts CSS template.
 * Returns font configs with family, src, weight, style, and optional satoriSrc.
 */
export async function parseFontsFromTemplate(
  nuxt: Nuxt,
  options: {
    convertedWoff2Files: Map<string, string>
  },
): Promise<ParsedFont[]> {
  // Cache on nuxt instance keyed by convertedWoff2Files state
  const cacheKey = `${options.convertedWoff2Files.size}:${[...options.convertedWoff2Files.keys()].sort().join(',')}`
  const cache: Map<string, ParsedFont[]> = (nuxt as any)._ogImageParsedFontsCache ||= new Map()
  const cached = cache.get(cacheKey)
  if (cached)
    return cached

  const templates = nuxt.options.build.templates
  const nuxtFontsTemplate = templates.find(t => t.filename?.endsWith('nuxt-fonts-global.css'))
  if (!nuxtFontsTemplate?.getContents) {
    return []
  }
  const contents = await nuxtFontsTemplate.getContents({} as any)

  // Include all @nuxt/fonts subsets — these are user-configured fonts and shouldn't be
  // filtered. Non-Latin subsets (devanagari, cyrillic, etc.) need to be available for
  // renderers like Takumi that support them natively. The fontSubsets config only controls
  // fontless downloads (Satori fallback path) to limit download size.
  const allFonts = await extractFontFacesWithSubsets(contents)

  // Dedupe: for each (family, weight, style, unicodeRange), prefer WOFF over WOFF2
  const fontMap = new Map<string, typeof allFonts[0]>()
  for (const font of allFonts) {
    const key = fontKey(font)
    const existing = fontMap.get(key)
    if (!existing || (existing.isWoff2 && !font.isWoff2)) {
      fontMap.set(key, font)
    }
  }

  // Convert to final format with satoriSrc
  // Prefer fontless-downloaded static fonts (keyed by font identity) over @nuxt/fonts WOFF
  // entries, which may be variable fonts that Satori can't parse.
  // Build set of families that have fontless static alternatives — for these families,
  // only use fontless paths as satoriSrc (don't trust @nuxt/fonts WOFF files which may be variable)
  const fontlessFamilies = new Set(
    Array.from(fontMap.values())
      .filter(f => options.convertedWoff2Files.has(`${f.family}-${f.weight}-${f.style}`))
      .map(f => f.family),
  )

  // Expand font entries for additional downloaded weights.
  // @nuxt/fonts may serve a variable font with a single weight (e.g. 400), but fontless
  // downloaded static alternatives for other weights (e.g. 700). Create font entries
  // for each downloaded weight so Satori can use them.
  const expandedFonts = Array.from(fontMap.values())
  const existingKeys = new Set(expandedFonts.map(f => `${f.family}-${f.weight}-${f.style}`))
  for (const [key] of options.convertedWoff2Files) {
    if (existingKeys.has(key))
      continue
    const match = key.match(/^(.+)-(\d+)-(.+)$/)
    if (!match)
      continue
    const [, family, weightStr, style] = match
    // Find a template font for this family+style to clone properties from
    const template = expandedFonts.find(f => f.family === family && f.style === style)
    if (!template)
      continue
    expandedFonts.push({ ...template, weight: Number(weightStr) })
    existingKeys.add(key)
  }

  const defaultUnicodeRange = 'U+0-FF, U+131, U+152-153, U+2BB-2BC, U+2C6, U+2DA, U+2DC, U+304, U+308, U+329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
  const result = expandedFonts.map((font) => {
    // Look up fontless static download by font identity (family+weight+style, no unicodeRange)
    const fKey = `${font.family}-${font.weight}-${font.style}`
    const fontlessPath = options.convertedWoff2Files.get(fKey)
    // Use fontless path if available. For families with fontless coverage, don't fall back
    // to @nuxt/fonts WOFF (may be variable fonts). For other families, use non-WOFF2 src.
    const satoriSrc = fontlessPath
      || (font.isWoff2 ? undefined : (fontlessFamilies.has(font.family) ? undefined : font.src))
    return {
      family: font.family,
      src: font.src,
      weight: font.weight,
      style: font.style,
      satoriSrc,
      unicodeRange: font.unicodeRange || defaultUnicodeRange,
    }
  })

  cache.set(cacheKey, result)
  return result
}

/** Download a font file if not already cached. Returns true on success. */
export async function downloadFontFile(url: string, destPath: string): Promise<boolean> {
  if (existsSync(destPath))
    return true
  const res = await fetch(url).catch(() => null)
  if (!res?.ok)
    return false
  await writeFile(destPath, Buffer.from(await res.arrayBuffer()))
  return true
}

// ============================================================================
// Static Inter Fonts (Bundled Fallback)
// ============================================================================

export function getStaticInterFonts(fontsDir?: string): ParsedFont[] {
  return [
    {
      family: 'Inter',
      src: '/_og-fonts/inter-400-latin.ttf',
      weight: 400,
      style: 'normal',
      satoriSrc: '/_og-fonts/inter-400-latin.ttf',
      absolutePath: fontsDir ? join(fontsDir, 'inter-400-latin.ttf') : undefined,
    },
    {
      family: 'Inter',
      src: '/_og-fonts/inter-700-latin.ttf',
      weight: 700,
      style: 'normal',
      satoriSrc: '/_og-fonts/inter-700-latin.ttf',
      absolutePath: fontsDir ? join(fontsDir, 'inter-700-latin.ttf') : undefined,
    },
  ]
}

// ============================================================================
// Font Output Copying
// ============================================================================

export function copyTtfFontsToOutput(options: {
  buildDir: string
  outputPublicDir: string
  logger: ConsolaInstance
}): void {
  const { buildDir, outputPublicDir, logger } = options
  const ttfSourceDir = join(buildDir, 'cache', 'og-image', 'fonts-ttf')

  if (!existsSync(ttfSourceDir))
    return

  const fontFiles = fs.readdirSync(ttfSourceDir).filter(f => f.endsWith('.ttf') || f.endsWith('.woff'))
  if (fontFiles.length === 0)
    return

  const outputDir = join(outputPublicDir, SATORI_FONTS_PREFIX.slice(1))
  fs.mkdirSync(outputDir, { recursive: true })

  for (const file of fontFiles) {
    const src = join(ttfSourceDir, file)
    const dest = join(outputDir, file)
    fs.copyFileSync(src, dest)
  }

  logger.debug(`Copied ${fontFiles.length} static fonts to output`)
}
