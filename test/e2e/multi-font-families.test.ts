import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { configureToMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/multi-font-families'),
  server: true,
  build: true,
})

const toMatchImageSnapshot = configureToMatchImageSnapshot({
  failureThresholdType: 'percent',
  failureThreshold: 1,
})
expect.extend({ toMatchImageSnapshot })

function extractOgImageUrl(html: string): string {
  const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
  const url = new URL(match![1]!)
  return url.pathname
}

describe('multi-font-families', () => {
  it('renders Lobster card (font-display, cursive)', async () => {
    const html = await $fetch('/') as string
    expect(html).toContain('og:image')
    const basePath = extractOgImageUrl(html)
    const png: ArrayBuffer = await $fetch(basePath, { responseType: 'arrayBuffer' })
    expect(Buffer.from(png)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'multi-font-lobster',
    })
  })

  it('renders Playfair Display card (font-serif)', async () => {
    const html = await $fetch('/playfair') as string
    expect(html).toContain('og:image')
    const basePath = extractOgImageUrl(html)
    const png: ArrayBuffer = await $fetch(basePath, { responseType: 'arrayBuffer' })
    expect(Buffer.from(png)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'multi-font-playfair',
    })
  })

  it('renders JetBrains Mono card (font-mono)', async () => {
    const html = await $fetch('/roboto') as string
    expect(html).toContain('og:image')
    const basePath = extractOgImageUrl(html)
    const png: ArrayBuffer = await $fetch(basePath, { responseType: 'arrayBuffer' })
    expect(Buffer.from(png)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'multi-font-jetbrains',
    })
  })

  it('renders variable font with bold weight', async () => {
    const html = await $fetch('/variable-bold') as string
    expect(html).toContain('og:image')
    const basePath = extractOgImageUrl(html)
    const png: ArrayBuffer = await $fetch(basePath, { responseType: 'arrayBuffer' })
    expect(Buffer.from(png)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'multi-font-variable-bold',
    })
  })

  it('downloads static font files for variable font weights', async () => {
    // Verify fontless downloaded static WOFF files under /_og-satori-fonts/ (not /_fonts/)
    const font400: ArrayBuffer = await $fetch('/_og-satori-fonts/Nunito_Sans-400-normal.woff', { responseType: 'arrayBuffer' })
    expect(font400.byteLength).toBeGreaterThan(1000)
    const font700: ArrayBuffer = await $fetch('/_og-satori-fonts/Nunito_Sans-700-normal.woff', { responseType: 'arrayBuffer' })
    expect(font700.byteLength).toBeGreaterThan(1000)
  })

  it('renders local font card', async () => {
    const html = await $fetch('/local-font') as string
    expect(html).toContain('og:image')
    const basePath = extractOgImageUrl(html)
    const png: ArrayBuffer = await $fetch(basePath, { responseType: 'arrayBuffer' })
    expect(Buffer.from(png)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'multi-font-local',
    })
  })

  it('serves local font files from public directory', async () => {
    // LocalSans (Inter TTF) — loaded via manual @font-face in main.css
    const sansRegular: ArrayBuffer = await $fetch('/fonts/LocalSans-Regular.ttf', { responseType: 'arrayBuffer' })
    expect(sansRegular.byteLength).toBeGreaterThan(1000)
    // LocalSerif (Merriweather TTF) — loaded via @nuxt/fonts provider: 'none'
    const serifRegular: ArrayBuffer = await $fetch('/fonts/LocalSerif-Regular.ttf', { responseType: 'arrayBuffer' })
    expect(serifRegular.byteLength).toBeGreaterThan(1000)
    const serifBold: ArrayBuffer = await $fetch('/fonts/LocalSerif-Bold.ttf', { responseType: 'arrayBuffer' })
    expect(serifBold.byteLength).toBeGreaterThan(1000)
  })

  it('renders takumi variable font with bold weight', async () => {
    const html = await $fetch('/takumi-variable-bold') as string
    expect(html).toContain('og:image')
    const basePath = extractOgImageUrl(html)
    const png: ArrayBuffer = await $fetch(basePath, { responseType: 'arrayBuffer' })
    expect(Buffer.from(png)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'multi-font-takumi-variable-bold',
    })
  })
}, 60000)
