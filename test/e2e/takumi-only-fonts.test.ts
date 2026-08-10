import { createResolver } from '@nuxt/kit'
import { $fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { fetchOgImage, getConvertedFontFiles, setupImageSnapshots, SNAPSHOT_LOOSE } from '../utils'

const { resolve } = createResolver(import.meta.url)

// Regression: https://github.com/nuxt-modules/og-image/issues/586
// Takumi-only setups (no satori component in the app) skipped fontless static-font
// downloads after v6.2.0, leaving @nuxt/fonts' latin-subset WOFF2 as the only source
// and causing non-latin glyphs (devanagari, CJK, etc.) to render as tofu.
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
  it.runIf(hasTakumi)('prepares static fonts for takumi-only apps', async () => {
    const convertedFonts = getConvertedFontFiles(useTestContext().nuxt!.options.buildDir)
    expect(convertedFonts.length).toBeGreaterThan(0)

    const fonts = await Promise.all(convertedFonts.map(filename =>
      $fetch(`/_og-static-fonts/${filename}`, { responseType: 'arrayBuffer' }) as Promise<ArrayBuffer>,
    ))
    for (const font of fonts)
      expect(Buffer.from(font).subarray(0, 4)).toEqual(Buffer.from([0, 1, 0, 0]))
  })

  it.runIf(hasTakumi)('renders devanagari glyphs through takumi', async () => {
    const image = await fetchOgImage('/')
    expect(image).toMatchImageSnapshot({ customSnapshotIdentifier: 'takumi-only-devanagari' })
  }, 60000)

  it.runIf(!hasTakumi)('skips when @takumi-rs/core not installed', () => {
    expect(true).toBe(true)
  })
})
