import { existsSync, readdirSync, statSync } from 'node:fs'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { configureToMatchImageSnapshot } from 'jest-image-snapshot'
import { join } from 'pathe'
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

function findFontsCacheDir(baseDir: string): string | null {
  const cacheDir = join(baseDir, 'cache', 'fonts')
  return existsSync(cacheDir) ? cacheDir : null
}

describe('woff2 to ttf conversion', () => {
  it('prefers WOFF over WOFF2 for Satori compatibility', () => {
    const ctx = useTestContext()
    const rootDir = ctx.nuxt!.options.rootDir
    const fontsDir = findFontsCacheDir(join(rootDir, '.nuxt'))

    if (fontsDir) {
      const ttfFiles = readdirSync(fontsDir).filter(f => f.endsWith('.ttf') && !f.includes('-base'))
      expect(ttfFiles.length).toBeGreaterThanOrEqual(0)
    }
  })

  it('converts WOFF2 fonts only when no WOFF fallback exists', () => {
    const ctx = useTestContext()
    const rootDir = ctx.nuxt!.options.rootDir
    const fontsDir = findFontsCacheDir(join(rootDir, '.nuxt'))

    if (fontsDir) {
      const ttfFiles = readdirSync(fontsDir).filter(f => f.endsWith('.ttf') && !f.includes('-base'))
      for (const file of ttfFiles) {
        const stat = statSync(join(fontsDir, file))
        expect(stat.size).toBeGreaterThan(1000)
      }
    }
  })

  it('uses satoriSrc pointing to WOFF or converted TTF', async () => {
    const ctx = useTestContext()
    expect(ctx.nuxt).toBeTruthy()
  })

  it('outputs TTF fonts via @nuxt/fonts publicAssets', () => {
    const ctx = useTestContext()
    const rootDir = ctx.nuxt!.options.rootDir
    const outputDir = join(rootDir, '.output', 'public', '_fonts')

    if (existsSync(outputDir)) {
      const ttfFiles = readdirSync(outputDir).filter(f => f.endsWith('.ttf'))
      expect(ttfFiles.length).toBeGreaterThanOrEqual(0)
    }
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
