import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/layers'),
  server: true,
  build: true,
})

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

describe('layers support', () => {
  it('resolves og image component from layer', async () => {
    const html = await $fetch('/layer-template') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    // Verify the image renders
    const image: ArrayBuffer = await $fetch(ogImageUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(image).length).toBeGreaterThan(0)
  })

  it('resolves og image component from app', async () => {
    const html = await $fetch('/app-template') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    // Verify the image renders
    const image: ArrayBuffer = await $fetch(ogImageUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(image).length).toBeGreaterThan(0)
  })

  it('debug endpoint shows components from both layer and app', async () => {
    const debug = await $fetch('/_og/debug.json') as { componentNames: Array<{ pascalName: string }> }
    const names = debug.componentNames.map(c => c.pascalName)

    // Components include OgImage prefix and renderer suffix
    expect(names.some(n => n.includes('LayerTemplate'))).toBe(true)
    expect(names.some(n => n.includes('AppTemplate'))).toBe(true)
  })
})
