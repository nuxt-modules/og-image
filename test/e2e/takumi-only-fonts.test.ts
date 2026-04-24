import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

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

describe('takumi-only fonts', () => {
  it.runIf(hasTakumi)('downloads static fallback fonts for takumi-only apps', async () => {
    // The regression: without a satori component, the pre-v6.2.0 build downloaded static
    // TTFs for takumi too; v6.2.0 narrowed the gate, so these files stopped being emitted
    // and non-latin scripts had nothing to fall back to when @nuxt/fonts shipped
    // latin-only subset WOFF2.
    const [devanagari, poppins] = await Promise.all([
      $fetch('/_og-static-fonts/Noto_Sans_Devanagari-400-normal.ttf', { responseType: 'arrayBuffer' }) as Promise<ArrayBuffer>,
      $fetch('/_og-static-fonts/Poppins-400-normal.ttf', { responseType: 'arrayBuffer' }) as Promise<ArrayBuffer>,
    ])
    expect(devanagari.byteLength).toBeGreaterThan(10_000)
    expect(poppins.byteLength).toBeGreaterThan(10_000)
  })

  it.runIf(!hasTakumi)('skips when @takumi-rs/core not installed', () => {
    expect(true).toBe(true)
  })
})
