import type { Nuxt } from '@nuxt/schema'
import type { ConsolaInstance } from 'consola'
import type { FontProcessingState } from './fonts'
import { readFileSync } from 'node:fs'
import { extractCustomFontFamilies } from './css/css-utils'
import { resolveAppCssPath } from './fonts'

const RE_FONT_FAMILY_DECLARATION = /font-family\s*:\s*([^;}]+)/g

/** Custom font families referenced by `font-family` in the app's CSS entry files. */
export function fontFamiliesFromCssEntries(css: Array<string | { src?: string } | undefined>, srcDir: string, rootDir: string = srcDir): string[] {
  const families = new Set<string>()
  for (const entry of css || []) {
    const cssPath = typeof entry === 'string' ? entry : entry?.src
    if (!cssPath)
      continue
    const resolved = resolveAppCssPath(cssPath, srcDir, rootDir)
    let content: string
    try {
      content = readFileSync(resolved, 'utf-8')
    }
    catch {
      continue
    }
    for (const match of content.matchAll(RE_FONT_FAMILY_DECLARATION)) {
      for (const family of extractCustomFontFamilies(match[1]!))
        families.add(family)
    }
  }
  return [...families]
}

/**
 * Warn when `@nuxt/fonts` reported no fonts and OG images would silently render
 * with the bundled Inter font. `@nuxt/fonts` reports every family before Nitro
 * builds. Development resolves families lazily during stylesheet transforms.
 */
export function warnWhenFontsUnreported(options: {
  nuxt: Pick<Nuxt, 'hook' | 'options'>
  logger: ConsolaInstance
  fontState: Pick<FontProcessingState, 'resolvedFaces'>
  /** Populates the CSS font variables read by `expectedFamilies`. */
  loadCssMetadata?: () => Promise<void>
  /** Families OG images may use beyond nuxt.options.fonts.families (CSS, component scan). */
  expectedFamilies: () => string[]
}): void {
  const { nuxt, logger, fontState, loadCssMetadata, expectedFamilies } = options
  let warned = false
  nuxt.hook('nitro:build:before', async () => {
    if (warned || (fontState.resolvedFaces?.size ?? 0) > 0)
      return
    // With the hook, dev resolution is lazy: families report as Vite transforms CSS, so an
    // empty report at Nitro build time is normal and would warn on every dev start.
    if (nuxt.options.dev)
      return
    await loadCssMetadata?.()
    const configuredFamilies = (nuxt.options as { fonts?: { families?: unknown[] } }).fonts?.families || []
    if (configuredFamilies.length === 0 && expectedFamilies().length === 0)
      return
    warned = true
    logger.warn('@nuxt/fonts did not report any fonts, so OG images use the bundled Inter font.')
  })
}
