import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/emojis'),
  server: true,
  build: true,
})

expect.extend({ toMatchImageSnapshot })

// Helper to extract og:image URL path from HTML
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

describe('local emoji rendering', () => {
  it('should render emoji OG image using local iconify files', async () => {
    // Fetch the index page HTML to get the og:image URL
    const html = await $fetch('/') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    // Fetch the OG image
    const ogImage = await $fetch(ogImageUrl!, {
      responseType: 'arrayBuffer',
    })

    // The image should not be empty
    expect(ogImage.byteLength).toBeGreaterThan(1000)

    // Test the visual output with image snapshot
    // Allow small differences due to build-time vs runtime emoji rendering
    expect(Buffer.from(ogImage)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'local-emoji-index-page',
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })
  }, 60000)

  it('should render alt-text-test page with emojis', async () => {
    // Fetch the alt-text-test page HTML
    const html = await $fetch('/alt-text-test') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    // Fetch the OG image
    const ogImage = await $fetch(ogImageUrl!, {
      responseType: 'arrayBuffer',
    })

    expect(ogImage.byteLength).toBeGreaterThan(1000)

    // Test the visual output with image snapshot
    // Allow small differences due to build-time vs runtime emoji rendering
    expect(Buffer.from(ogImage)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'local-emoji-alt-text-test',
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })
  }, 60000)

  it('should render dynamic emoji passed via props at runtime', async () => {
    // Fetch the dynamic-emoji page HTML
    const html = await $fetch('/dynamic-emoji') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    // Fetch the OG image
    const ogImage = await $fetch(ogImageUrl!, {
      responseType: 'arrayBuffer',
    })

    // Image should render successfully with dynamic emoji
    expect(ogImage.byteLength).toBeGreaterThan(1000)
  }, 60000)
})
