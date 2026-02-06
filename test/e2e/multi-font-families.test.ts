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
}, 60000)
