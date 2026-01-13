import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/build-transforms'),
  server: true,
  build: true,
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

describe('build-time transforms', () => {
  it('should render OG image with inlined icons', async () => {
    const html = await $fetch('/') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    const ogImage = await $fetch(ogImageUrl!, {
      responseType: 'arrayBuffer',
    })

    expect(ogImage.byteLength).toBeGreaterThan(1000)

    expect(Buffer.from(ogImage)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'build-transforms-icon-test',
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })
  }, 60000)

  it('should render OG image with inlined images', async () => {
    const html = await $fetch('/image-test') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    const ogImage = await $fetch(ogImageUrl!, {
      responseType: 'arrayBuffer',
    })

    expect(ogImage.byteLength).toBeGreaterThan(1000)

    expect(Buffer.from(ogImage)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'build-transforms-image-test',
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })
  }, 60000)

  it('should render OG image with both icons and images inlined', async () => {
    const html = await $fetch('/combined-test') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    const ogImage = await $fetch(ogImageUrl!, {
      responseType: 'arrayBuffer',
    })

    expect(ogImage.byteLength).toBeGreaterThan(1000)

    expect(Buffer.from(ogImage)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'build-transforms-combined-test',
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })
  }, 60000)
})
