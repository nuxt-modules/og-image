import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'
import { extractOgImageUrl, fetchOgImage, imageHasColor } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/tailwind'),
  server: true,
  build: true,
  nuxtConfig: {
    sourcemap: false,
  },
})

expect.extend({ toMatchImageSnapshot })

describe('tailwind', () => {
  it('renders og image with tailwind classes', async () => {
    const image = await fetchOgImage('/')
    expect(image).toMatchImageSnapshot()
  })

  it('compiles with @plugin directive (loadModule)', async () => {
    const html = await $fetch('/') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()

    const htmlPath = ogUrl!.replace(/\.png$/, '.html')
    const htmlPreview = await $fetch(htmlPath) as string

    expect(htmlPreview).toContain('Hello World')
  })

  it('extracts expected colors from og image', async () => {
    const image = await fetchOgImage('/')
    expect(await imageHasColor(image, ({ r, g, b }) => g > r + 30 && g > b + 30)).toBe(true)
  })
}, 60000)
