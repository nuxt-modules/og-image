import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
})

// Helper to extract og:image URL path from HTML (handles both absolute and relative URLs)
function extractOgImageUrl(html: string): string | null {
  const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
  if (!match?.[1])
    return null
  // Extract just the path from absolute URL (e.g., https://nuxtseo.com/_og/d/... -> /_og/d/...)
  try {
    const url = new URL(match[1])
    return url.pathname
  }
  catch {
    return match[1] // Already a relative path
  }
}

describe('computed props', () => {
  it('renders page with computed props without crashing', async () => {
    const html = await $fetch('/satori/computed') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    // Fetch the image to ensure it generates correctly
    const image = await $fetch(ogImageUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(image).toBeTruthy()
    expect(image.byteLength).toBeGreaterThan(0)
  }, 60000)
})
