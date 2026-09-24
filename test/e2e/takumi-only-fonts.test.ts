import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createResolver } from '@nuxt/kit'
import { setup, useTestContext } from '@nuxt/test-utils/e2e'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { fetchOgImage, setupImageSnapshots, SNAPSHOT_LOOSE } from '../utils'

const { resolve } = createResolver(import.meta.url)

// Regression: https://github.com/nuxt-modules/og-image/issues/586
// Takumi supports WOFF2 directly. Subset family chaining lets it use every
// unicode-range asset emitted by Nuxt Fonts without a TTF conversion step.
let hasTakumi = false
try {
  await import('@takumi-rs/core')
  hasTakumi = true
}
catch {
  hasTakumi = false
}

await setup({
  rootDir: resolve('../fixtures/takumi-only-fonts'),
  server: true,
  build: true,
})

setupImageSnapshots(SNAPSHOT_LOOSE)

describe('takumi-only fonts', () => {
  it.runIf(hasTakumi)('uses Nuxt Fonts WOFF2 assets directly', async () => {
    const buildDir = useTestContext().nuxt!.options.buildDir
    // og-image copies the files @nuxt/fonts serves here, for dev and prerender
    const nuxtFontsDir = join(buildDir, 'cache', 'og-image', 'nuxt-fonts')
    const files = readdirSync(nuxtFontsDir).filter(file => file.endsWith('.woff2'))
    expect(files.length).toBeGreaterThan(0)
    const staticFontDir = join(buildDir, 'cache', 'og-image', 'static-fonts')
    expect(files.some(file => existsSync(join(staticFontDir, file.replace(/\.woff2$/, '.ttf'))))).toBe(false)
    for (const file of files)
      expect.soft(readFileSync(join(nuxtFontsDir, file)).subarray(0, 4).toString()).toBe('wOF2')
  })

  it.runIf(hasTakumi)('renders devanagari glyphs through takumi', async () => {
    const image = await fetchOgImage('/')
    expect(image).toMatchImageSnapshot({ customSnapshotIdentifier: 'takumi-only-devanagari' })
  }, 60000)

  it.runIf(!hasTakumi)('skips when @takumi-rs/core not installed', () => {
    expect(true).toBe(true)
  })
})
