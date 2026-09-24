import type { Nuxt } from '@nuxt/schema'
import type { ConsolaInstance } from 'consola'
import type { Dirent } from 'node:fs'
import type { FontProcessingState } from './fonts'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'pathe'
import { extractCustomFontFamilies } from './css/css-utils'
import { resolveAppCssPath } from './fonts'

const RE_IMPLEMENTATION_FILE = /\.[cm]?js$/
const FONTS_RESOLVED_HOOK = 'fonts:resolved'
const RE_FONT_FAMILY_DECLARATION = /font-family\s*:\s*([^;}]+)/g

function* implementationFiles(dir: string): Generator<string> {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  }
  catch {
    return
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules')
        yield* implementationFiles(path)
    }
    else if (entry.isFile() && RE_IMPLEMENTATION_FILE.test(entry.name)) {
      yield path
    }
  }
}

/**
 * Whether the installed `@nuxt/fonts` calls the `fonts:resolved` hook. Released
 * versions up to 0.14 do not, but the `>=0.13.0` compatibility range admits
 * them, so the hook is detected in the installed code itself. The resolved
 * module path sits inside the package, which is scanned for the hook name.
 */
export function fontsResolvedHookAvailable(fontsModulePath: string): boolean {
  const moduleDir = dirname(fontsModulePath)
  let root = moduleDir
  for (let depth = 0; depth < 4; depth++) {
    if (existsSync(join(root, 'package.json')))
      break
    const parent = dirname(root)
    if (parent === root)
      break
    root = parent
  }
  // Only scan a real package root; without one, the module's own directory
  const packageRoot = existsSync(join(root, 'package.json')) ? root : moduleDir
  for (const file of implementationFiles(packageRoot)) {
    try {
      if (readFileSync(file, 'utf-8').includes(FONTS_RESOLVED_HOOK))
        return true
    }
    catch {
      continue
    }
  }
  return false
}

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
 * builds; versions without the `fonts:resolved` hook report none.
 */
export function warnWhenFontsUnreported(options: {
  nuxt: Pick<Nuxt, 'hook' | 'options'>
  logger: ConsolaInstance
  fontState: Pick<FontProcessingState, 'resolvedFaces'>
  /** Populates the CSS font variables read by `expectedFamilies`. */
  loadCssMetadata?: () => Promise<void>
  /** Families OG images may use beyond nuxt.options.fonts.families (CSS, component scan). */
  expectedFamilies: () => string[]
  /** Whether the installed `@nuxt/fonts` calls the `fonts:resolved` hook. */
  fontsResolvedHook?: boolean
}): void {
  const { nuxt, logger, fontState, loadCssMetadata, expectedFamilies, fontsResolvedHook = false } = options
  let warned = false
  nuxt.hook('nitro:build:before', async () => {
    if (warned || (fontState.resolvedFaces?.size ?? 0) > 0)
      return
    // With the hook, dev resolution is lazy: families report as Vite transforms CSS, so an
    // empty report at Nitro build time is normal and would warn on every dev start.
    if (nuxt.options.dev && fontsResolvedHook)
      return
    await loadCssMetadata?.()
    const configuredFamilies = (nuxt.options as { fonts?: { families?: unknown[] } }).fonts?.families || []
    if (configuredFamilies.length === 0 && expectedFamilies().length === 0)
      return
    warned = true
    logger.warn('@nuxt/fonts did not report any fonts, so OG images use the bundled Inter font. OG images need a @nuxt/fonts version with the `fonts:resolved` hook.')
  })
}
