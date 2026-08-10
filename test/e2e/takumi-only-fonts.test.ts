import { existsSync, readFileSync } from 'node:fs'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'
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
    const mapping = JSON.parse(readFileSync(join(buildDir, 'cache', 'og-image', 'font-urls.json'), 'utf8')) as Record<string, string>
    const staticFontDir = join(buildDir, 'cache', 'og-image', 'static-fonts')
    const hasConvertedFont = Object.keys(mapping).some(filename => existsSync(join(staticFontDir, filename.replace(/\.woff2$/, '.ttf'))))
    expect(hasConvertedFont).toBe(false)

    const filename = Object.entries(mapping).find(([, source]) => source.includes('/notosansdevanagari/'))?.[0]
    expect(filename).toBeDefined()
    const font = await $fetch(`/_fonts/${filename}`, { responseType: 'arrayBuffer' }) as ArrayBuffer
    expect(Buffer.from(font).subarray(0, 4).toString()).toBe('wOF2')
  })

  it.runIf(hasTakumi)('renders devanagari glyphs through takumi', async () => {
    const image = await fetchOgImage('/')
    expect(image).toMatchImageSnapshot({ customSnapshotIdentifier: 'takumi-only-devanagari' })
  }, 60000)

  it.runIf(!hasTakumi)('skips when @takumi-rs/core not installed', () => {
    expect(true).toBe(true)
  })
})
