import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import getColors from 'get-image-colors'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'
import { extractOgImageUrl, fetchOgImage } from '../utils'

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
    const colors = await getColors(image, 'image/png')
    const hexColors = colors.map(c => c.hex())

    expect(hexColors.length).toBeGreaterThanOrEqual(2)

    const hasGreen = hexColors.some((hex) => {
      const r = Number.parseInt(hex.slice(1, 3), 16)
      const g = Number.parseInt(hex.slice(3, 5), 16)
      const b = Number.parseInt(hex.slice(5, 7), 16)
      return g > r + 30 && g > b + 30
    })
    expect(hasGreen).toBe(true)
  })
}, 60000)
