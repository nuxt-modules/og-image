import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
})

expect.extend({ toMatchImageSnapshot })

function getImageDimensions(buffer: Buffer): { width: number, height: number } {
  // PNG header: width at bytes 16-19, height at bytes 20-23 (big endian)
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    }
  }
  throw new Error('Not a valid PNG')
}

// Helper to extract URL path from absolute URL
function extractPath(urlStr: string): string {
  try {
    const url = new URL(urlStr)
    return url.pathname
  }
  catch {
    return urlStr // Already a relative path
  }
}

// Helper to extract all og:image and twitter:image URL paths from HTML
function extractImageUrls(html: string): { og: string[], twitter: string[] } {
  const ogMatches = html.matchAll(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/g)
  const twitterMatches = html.matchAll(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/g)
  return {
    og: [...ogMatches].map(m => extractPath(m[1]!)),
    twitter: [...twitterMatches].map(m => extractPath(m[1]!)),
  }
}

describe('multiple og images', () => {
  it('prerender generates images with correct dimensions', async () => {
    // Get the page HTML to extract image URLs
    const html: string = await $fetch('/satori/multi-image')
    const urls = extractImageUrls(html)

    // Twitter image should be in twitter:image (1200x600)
    expect(urls.twitter.length).toBeGreaterThan(0)
    const twitterUrl = urls.twitter[0]
    const twitterImage: ArrayBuffer = await $fetch(twitterUrl, {
      responseType: 'arrayBuffer',
    })
    const twitterBuffer = Buffer.from(twitterImage)
    const twitterDims = getImageDimensions(twitterBuffer)
    expect(twitterDims.width).toBe(1200)
    expect(twitterDims.height).toBe(600)
    expect(twitterBuffer).toMatchImageSnapshot()

    // WhatsApp image should be in og:image (800x800)
    expect(urls.og.length).toBeGreaterThan(0)
    const whatsappUrl = urls.og[0]
    const whatsappImage: ArrayBuffer = await $fetch(whatsappUrl, {
      responseType: 'arrayBuffer',
    })
    const whatsappBuffer = Buffer.from(whatsappImage)
    const whatsappDims = getImageDimensions(whatsappBuffer)
    expect(whatsappDims.width).toBe(800)
    expect(whatsappDims.height).toBe(800)
    expect(whatsappBuffer).toMatchImageSnapshot()
  })

  it('generates correct meta tags per key', async () => {
    const html: string = await $fetch('/satori/multi-image')

    // Twitter key should only have twitter:* meta tags
    expect(html).toContain('twitter:image')
    expect(html).toContain('twitter:image:width" content="1200"')
    expect(html).toContain('twitter:image:height" content="600"')

    // Whatsapp key should only have og:image meta tags
    expect(html).toContain('og:image')
    expect(html).toContain('og:image:width" content="800"')
    expect(html).toContain('og:image:height" content="800"')

    // Check that twitter URL contains k_twitter in encoded params
    const urls = extractImageUrls(html)
    expect(urls.twitter[0]).toContain('k_twitter')

    // Check that og URL contains k_whatsapp in encoded params
    expect(urls.og[0]).toContain('k_whatsapp')
  })
})
