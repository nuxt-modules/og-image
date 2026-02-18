import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { configureToMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

function extractOgImageUrl(html: string): string {
  const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
  const url = new URL(match![1]!)
  return url.pathname
}

// Regression test: in dev mode, vite:compiled fires before OG components are lazily compiled,
// so convertWoff2ToTtf() never runs and WOFF2 fonts render as tofu (missing glyph rectangles).
// The fix adds lazy conversion in the #og-image/fonts virtual module resolver.
describe.skipIf(!import.meta.env?.TEST_DEV)('dev satori fonts', async () => {
  await setup({
    rootDir: resolve('../fixtures/multi-font-families'),
    dev: true,
  })

  const toMatchImageSnapshot = configureToMatchImageSnapshot({
    failureThresholdType: 'percent',
    failureThreshold: 1,
  })
  expect.extend({ toMatchImageSnapshot })

  it('renders variable font with bold weight in dev mode', async () => {
    const html = await $fetch('/variable-bold') as string
    expect(html).toContain('og:image')
    const basePath = extractOgImageUrl(html)
    const png: ArrayBuffer = await $fetch(basePath, { responseType: 'arrayBuffer' })
    expect(Buffer.from(png)).toMatchImageSnapshot({
      // Reuse the same snapshot as the build-mode test — output should be identical
      customSnapshotIdentifier: 'multi-font-variable-bold',
    })
  })

  it('renders Lobster card (non-variable font) in dev mode', async () => {
    const html = await $fetch('/') as string
    expect(html).toContain('og:image')
    const basePath = extractOgImageUrl(html)
    const png: ArrayBuffer = await $fetch(basePath, { responseType: 'arrayBuffer' })
    expect(Buffer.from(png)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'multi-font-lobster',
    })
  })

  // Regression test: in dev mode, /_fonts/ URLs from @nuxt/fonts are served by a Nuxt dev
  // server handler (addDevServerHandler), which isn't reachable via Nitro's event.$fetch.
  // The fix persists the font URL mapping so the resolver can download directly from the CDN.
  it('renders takumi variable font in dev mode (/_fonts/ resolution)', async () => {
    const html = await $fetch('/takumi-variable-bold') as string
    expect(html).toContain('og:image')
    const basePath = extractOgImageUrl(html)
    const png: ArrayBuffer = await $fetch(basePath, { responseType: 'arrayBuffer' })
    expect(Buffer.from(png)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'multi-font-takumi-variable-bold',
    })
  })
}, 60000)
