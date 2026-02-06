/**
 * Pure font processing — types, helpers, CSS parsing, and file management.
 * No external font resolution deps (fontless/unifont live in ./fontless.ts).
 */

import type { ConsolaInstance } from 'consola'
import type { Nuxt } from 'nuxt/schema'
import type { OgImageComponent } from '../runtime/types'
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

/** Shared font URL prefix used by both build and runtime font resolution */
export const FONTS_URL_PREFIX = '/_fonts'

export interface FontProcessingState {
  /** Set of WOFF2 filenames that were successfully converted to TTF */
  convertedWoff2Files: Set<string>
  /** Whether font processing has completed */
  done: boolean
}

export interface FontRequirementsState {
  weights: number[]
  styles: Array<'normal' | 'italic'>
  /** Resolved font family names. Empty = don't filter by family. */
  families: string[]
  isComplete: boolean
  componentMap: Record<string, { weights: number[], styles: Array<'normal' | 'italic'>, families: string[], isComplete: boolean }>
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

  // Always include the default font family (font-sans) when filtering
  const defaultVar = fontVars['font-sans']
  if (defaultVar) {
    for (const f of extractCustomFontFamilies(defaultVar))
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

/**
 * Scan OG image components for font weight/style/family usage and resolve to actual family names.
 */
export async function buildFontRequirements(options: {
  components: OgImageComponent[]
  buildDir: string
  fontVars: Record<string, string>
  logger: ConsolaInstance
}): Promise<FontRequirementsState> {
  const { scanFontRequirements } = await import('./css/css-classes')
  const result = await scanFontRequirements(options.components, options.logger, options.buildDir)

  const families = resolveFontFamilies(
    result.global.familyClasses,
    result.global.familyNames,
    options.fontVars,
  )

  const componentMap = Object.fromEntries(
    Object.entries(result.components).map(([name, comp]) => [name, {
      weights: comp.weights,
      styles: comp.styles,
      families: resolveFontFamilies(comp.familyClasses, comp.familyNames, options.fontVars),
      isComplete: comp.isComplete,
    }]),
  )

  return {
    weights: result.global.weights,
    styles: result.global.styles,
    families,
    isComplete: result.global.isComplete,
    componentMap,
  }
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
    convertedWoff2Files: Set<string>
    fontSubsets?: string[]
  },
): Promise<ParsedFont[]> {
  // Cache on nuxt instance keyed by convertedWoff2Files state
  const cacheKey = `${options.convertedWoff2Files.size}:${[...options.convertedWoff2Files].sort().join(',')}`
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
  const configuredSubsets = options.fontSubsets || ['latin']

  // Parse @font-face rules with subset filtering (handles Google Fonts /* latin */ comments)
  const allFonts = await extractFontFacesWithSubsets(contents, configuredSubsets)

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
  const defaultUnicodeRange = 'U+0-FF, U+131, U+152-153, U+2BB-2BC, U+2C6, U+2DA, U+2DC, U+304, U+308, U+329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
  const result = Array.from(fontMap.values()).map((font) => {
    // For WOFF2 fonts, only set satoriSrc if the file was actually converted to TTF
    const woff2Filename = font.src.split('/').pop()!
    const satoriSrc = font.isWoff2
      ? (options.convertedWoff2Files.has(woff2Filename) ? `${FONTS_URL_PREFIX}/${woff2Filename.replace('.woff2', '.ttf')}` : undefined)
      : font.src
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

  const ttfFiles = fs.readdirSync(ttfSourceDir).filter(f => f.endsWith('.ttf'))
  if (ttfFiles.length === 0)
    return

  const outputDir = join(outputPublicDir, FONTS_URL_PREFIX.slice(1))
  fs.mkdirSync(outputDir, { recursive: true })

  for (const file of ttfFiles) {
    const src = join(ttfSourceDir, file)
    const dest = join(outputDir, file)
    fs.copyFileSync(src, dest)
  }

  logger.debug(`Copied ${ttfFiles.length} converted TTF fonts to output`)
}
