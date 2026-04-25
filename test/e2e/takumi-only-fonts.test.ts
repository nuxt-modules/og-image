import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { fetchOgImage, setupImageSnapshots, SNAPSHOT_LOOSE } from '../utils'

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
  it.runIf(hasTakumi)('downloads static fallback fonts for takumi-only apps', async () => {
    // Direct check on the build output: pre-v6.2.0 emitted these for takumi too; v6.2.0
    // narrowed the gate so a takumi-only app got no static TTFs at all and non-latin
    // scripts had nothing to fall back to.
    const [devanagari, poppins] = await Promise.all([
      $fetch('/_og-static-fonts/Noto_Sans_Devanagari-400-normal.ttf', { responseType: 'arrayBuffer' }) as Promise<ArrayBuffer>,
      $fetch('/_og-static-fonts/Poppins-400-normal.ttf', { responseType: 'arrayBuffer' }) as Promise<ArrayBuffer>,
    ])
    expect(devanagari.byteLength).toBeGreaterThan(10_000)
    expect(poppins.byteLength).toBeGreaterThan(10_000)
  })

  it.runIf(hasTakumi)('renders devanagari glyphs through takumi', async () => {
    const image = await fetchOgImage('/')
    expect(image).toMatchImageSnapshot({ customSnapshotIdentifier: 'takumi-only-devanagari' })
  }, 60000)

  it.runIf(!hasTakumi)('skips when @takumi-rs/core not installed', () => {
    expect(true).toBe(true)
  })
})
