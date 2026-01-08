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

describe('multiple og images', () => {
  it('prerender generates images with correct dimensions', async () => {
    // Twitter image (1200x600)
    const twitterImage: ArrayBuffer = await $fetch('/__og-image__/static/satori/multi-image/twitter.png', {
      responseType: 'arrayBuffer',
    })
    const twitterBuffer = Buffer.from(twitterImage)
    const twitterDims = getImageDimensions(twitterBuffer)
    expect(twitterDims.width).toBe(1200)
    expect(twitterDims.height).toBe(600)
    expect(twitterBuffer).toMatchImageSnapshot()

    // WhatsApp image (800x800)
    const whatsappImage: ArrayBuffer = await $fetch('/__og-image__/static/satori/multi-image/whatsapp.png', {
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
    expect(html).toContain('multi-image/twitter.png')
    expect(html).toContain('twitter:image:width" content="1200"')
    expect(html).toContain('twitter:image:height" content="600"')

    // Whatsapp key should only have og:image meta tags
    expect(html).toContain('og:image')
    expect(html).toContain('multi-image/whatsapp.png')
    expect(html).toContain('og:image:width" content="800"')
    expect(html).toContain('og:image:height" content="800"')

    // Twitter image should NOT have og:image tags
    expect(html).not.toMatch(/og:image"[^>]*twitter\.png/)

    // Whatsapp image should NOT have twitter:image tags
    expect(html).not.toMatch(/twitter:image"[^>]*whatsapp\.png/)
  })
})
