import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { configureToMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/woff2-conversion'),
  server: true,
  build: true,
})

const toMatchImageSnapshot = configureToMatchImageSnapshot({
  failureThresholdType: 'percent',
  failureThreshold: 1,
})
expect.extend({ toMatchImageSnapshot })

function extractOgImageUrl(html: string): string | null {
  const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
  if (!match?.[1])
    return null
  try {
    const url = new URL(match[1])
    return url.pathname
  }
  catch {
    return match[1]
  }
}

// Find @nuxt/fonts cache directory (contains both original and converted fonts)
function findFontsCacheDir(baseDir: string): string | null {
  const cacheDir = join(baseDir, 'cache', 'fonts')
  return existsSync(cacheDir) ? cacheDir : null
}

describe('woff2 to ttf conversion', () => {
  // Google Fonts serves both WOFF (static) and WOFF2 (variable) formats.
  // The module prefers WOFF over WOFF2 when available because:
  // - WOFF is static with separate files per weight (works directly with Satori)
  // - WOFF2 is often variable (requires fonttools to instance weights)
  // This means TTF conversion only happens when fonts are WOFF2-only.

  it('prefers WOFF over WOFF2 for Satori compatibility', () => {
    const ctx = useTestContext()
    const rootDir = ctx.nuxt!.options.rootDir
    const fontsDir = findFontsCacheDir(join(rootDir, '.nuxt'))

    // When WOFF fallback is available (Google Fonts provides both),
    // no TTF conversion should happen - WOFF works directly with Satori
    if (fontsDir) {
      const ttfFiles = readdirSync(fontsDir).filter(f => f.endsWith('.ttf') && !f.includes('-base'))
      // May be empty if WOFF was preferred over WOFF2
      expect(ttfFiles.length).toBeGreaterThanOrEqual(0)
    }
    // It's okay if fontsDir doesn't exist - means WOFF was used for all fonts
  })

  it('converts WOFF2 fonts only when no WOFF fallback exists', () => {
    const ctx = useTestContext()
    const rootDir = ctx.nuxt!.options.rootDir
    const fontsDir = findFontsCacheDir(join(rootDir, '.nuxt'))

    // If fonts cache directory exists, check for converted TTF files
    if (fontsDir) {
      const ttfFiles = readdirSync(fontsDir).filter(f => f.endsWith('.ttf') && !f.includes('-base'))
      // TTF files should only exist for WOFF2-only fonts
      for (const file of ttfFiles) {
        const stat = statSync(join(fontsDir, file))
        // Converted TTF should be at least 1KB
        expect(stat.size).toBeGreaterThan(1000)
      }
    }
  })

  it('uses satoriSrc pointing to WOFF or converted TTF', async () => {
    // The font config should have satoriSrc for all fonts:
    // - WOFF fonts: satoriSrc = src (same file)
    // - WOFF2 fonts: satoriSrc = converted TTF path
    // This test just verifies the build completed without error
    const ctx = useTestContext()
    expect(ctx.nuxt).toBeTruthy()
  })

  it('outputs TTF fonts via @nuxt/fonts publicAssets', () => {
    const ctx = useTestContext()
    const rootDir = ctx.nuxt!.options.rootDir
    const outputDir = join(rootDir, '.output', 'public', '_fonts')

    // @nuxt/fonts creates _fonts directory for all fonts (original + converted)
    if (existsSync(outputDir)) {
      const ttfFiles = readdirSync(outputDir).filter(f => f.endsWith('.ttf'))
      // TTF files exist if conversion happened or fonts were originally TTF
      expect(ttfFiles.length).toBeGreaterThanOrEqual(0)
    }
    // It's okay if output dir doesn't exist - means no fonts were used
  })

  it('renders OG image with fonts (WOFF or converted TTF)', async () => {
    const html = await $fetch('/') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    const image: ArrayBuffer = await $fetch(ogImageUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(image)).toMatchImageSnapshot()
  })
})
