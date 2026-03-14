import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { extractImageUrls, getImageDimensions, setupImageSnapshots, SNAPSHOT_LOOSE } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
})

setupImageSnapshots(SNAPSHOT_LOOSE)

describe('multiple og images', () => {
  it('prerender generates images with correct dimensions', async () => {
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

    expect(html).toContain('twitter:image')
    expect(html).toContain('twitter:image:width" content="1200"')
    expect(html).toContain('twitter:image:height" content="600"')

    expect(html).toContain('og:image')
    expect(html).toContain('og:image:width" content="800"')
    expect(html).toContain('og:image:height" content="800"')

    const urls = extractImageUrls(html)
    expect(urls.twitter[0]).toContain('k_twitter')
    expect(urls.og[0]).toContain('k_whatsapp')
  })
})
