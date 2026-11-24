import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/server-route-image'),
  server: true,
  build: true,
})

async function centerPixel(image: ArrayBuffer) {
  const { width, height } = await sharp(image).metadata()
  const pixel = await sharp(image)
    .extract({ left: Math.floor(width! / 2), top: Math.floor(height! / 2), width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer()
  return [...pixel]
}

describe('prerendered template image from a server route', () => {
  it.each(['takumi', 'satori'])('%s embeds the server route image', async (renderer) => {
    const html: string = await $fetch(`/${renderer}`)
    const ogUrl = html.match(/property="og:image" content="([^"]+)"/)?.[1]
    expect(ogUrl, 'the page should prerender its og image to /_og/s/').toContain('/_og/s/')
    const image: ArrayBuffer = await $fetch(new URL(ogUrl!).pathname, { responseType: 'arrayBuffer' })
    // The template background is white; the server route image is solid red.
    expect(await centerPixel(image)).toEqual([255, 0, 0])
  })
})
