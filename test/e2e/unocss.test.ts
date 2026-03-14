import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import getColors from 'get-image-colors'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'
import { extractOgImageUrl, fetchOgImage } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/unocss'),
  server: true,
  build: true,
  nuxtConfig: {
    sourcemap: false,
  },
})

expect.extend({ toMatchImageSnapshot })

describe('unocss', () => {
  it('renders og image with unocss classes', async () => {
    const image = await fetchOgImage('/')
    expect(image).toMatchImageSnapshot()
  })

  it('renders html preview with unocss styles', async () => {
    const html = await $fetch('/') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()

    const htmlPath = ogUrl!.replace(/\.png$/, '.html')
    const htmlPreview = await $fetch(htmlPath) as string
    expect(htmlPreview).toContain('UnoCSS')
    expect(htmlPreview).toMatch(/style="[^"]*background-color:\s*#/)
    expect(htmlPreview).toContain('primary')
    expect(htmlPreview).toContain('brand')
    expect(htmlPreview).toContain('accent')
  })

  it('extracts expected colors from og image', async () => {
    const image = await fetchOgImage('/')
    const colors = await getColors(image, 'image/png')
    const hexColors = colors.map(c => c.hex())

    expect(hexColors.length).toBeGreaterThanOrEqual(3)

    const hasChroma = hexColors.some((hex) => {
      const r = Number.parseInt(hex.slice(1, 3), 16)
      const g = Number.parseInt(hex.slice(3, 5), 16)
      const b = Number.parseInt(hex.slice(5, 7), 16)
      return Math.abs(r - g) > 30 || Math.abs(g - b) > 30 || Math.abs(r - b) > 30
    })
    expect(hasChroma).toBe(true)
  })

  it('resolves compound data-* rootAttrs for themed OG image', async () => {
    const html = await $fetch('/themed') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()

    const htmlPath = ogUrl!.replace(/\.png$/, '.html')
    const htmlPreview = await $fetch(htmlPath) as string

    expect(htmlPreview).toContain('Dark Themed')
    expect(htmlPreview).not.toMatch(/background-color:\s*var\(--bg\)/)
    expect(htmlPreview).toMatch(/background-color:\s*#0f172a/i)
    expect(htmlPreview).not.toMatch(/(?<![a-z-])color:\s*var\(--fg\)/)
  })

  it('renders themed og image snapshot', async () => {
    const image = await fetchOgImage('/themed')
    expect(image).toMatchImageSnapshot()
  })

  it('resolves zinc bg-theme differently from slate', async () => {
    const html = await $fetch('/themed-zinc') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()

    const htmlPath = ogUrl!.replace(/\.png$/, '.html')
    const htmlPreview = await $fetch(htmlPath) as string

    expect(htmlPreview).toContain('Dark Zinc')
    expect(htmlPreview).toMatch(/background-color:\s*#18181b/i)
    expect(htmlPreview).toMatch(/background-color:\s*#27272a/i)
  })

  it('renders zinc themed og image snapshot', async () => {
    const image = await fetchOgImage('/themed-zinc')
    expect(image).toMatchImageSnapshot()
  })
}, 60000)
