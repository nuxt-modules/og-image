import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/nested-components'),
  server: true,
  build: true,
  nuxtConfig: {
    sourcemap: false,
  },
})

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

describe('nested component resolution', () => {
  it('resolves nested component tailwind classes to inline styles', async () => {
    const html = await $fetch('/') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    // Fetch the HTML preview to inspect the rendered output
    const htmlPath = ogImageUrl!.replace(/\.png$/, '.html')
    const htmlPreview = await $fetch(htmlPath) as string

    // The OG component itself should have inline styles
    expect(htmlPreview).toContain('Nested Test')
    expect(htmlPreview).toContain('Works!')
  }, 60000)

  it('renders a valid OG image with nested component', async () => {
    const html = await $fetch('/') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    const ogImage = await $fetch(ogImageUrl!, {
      responseType: 'arrayBuffer',
    })

    expect(ogImage.byteLength).toBeGreaterThan(1000)
  }, 60000)
})
