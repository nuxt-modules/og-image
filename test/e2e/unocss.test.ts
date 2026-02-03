import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import getColors from 'get-image-colors'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

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
    const html = await $fetch('/') as string
    expect(html).toContain('og:image')

    const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
      || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
    expect(match?.[1]).toBeTruthy()

    const ogUrl = new URL(match![1]!)
    const basePath = ogUrl.pathname

    const png: ArrayBuffer = await $fetch(basePath, { responseType: 'arrayBuffer' })
    expect(Buffer.from(png)).toMatchImageSnapshot()
  })

  it('renders html preview with unocss styles', async () => {
    const html = await $fetch('/') as string
    const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
      || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
    const ogUrl = new URL(match![1]!)

    const htmlPath = ogUrl.pathname.replace(/\.png$/, '.html')
    const htmlPreview = await $fetch(htmlPath) as string
    expect(htmlPreview).toContain('UnoCSS')
    // Verify unocss classes are resolved to inline styles
    expect(htmlPreview).toMatch(/style="[^"]*background-color:\s*#/)
    // Verify custom theme colors are resolved
    expect(htmlPreview).toContain('primary')
    expect(htmlPreview).toContain('brand')
    expect(htmlPreview).toContain('accent')
  })

  it('extracts expected colors from og image', async () => {
    const html = await $fetch('/') as string
    const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
      || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
    const ogUrl = new URL(match![1]!)
    const basePath = ogUrl.pathname

    const png: ArrayBuffer = await $fetch(basePath, { responseType: 'arrayBuffer' })
    const colors = await getColors(Buffer.from(png), 'image/png')
    const hexColors = colors.map(c => c.hex())

    // Verify image has multiple distinct colors (not blank/broken)
    expect(hexColors.length).toBeGreaterThanOrEqual(3)

    // Verify colors aren't all grayscale (custom colors resolved)
    const hasChroma = hexColors.some((hex) => {
      const r = Number.parseInt(hex.slice(1, 3), 16)
      const g = Number.parseInt(hex.slice(3, 5), 16)
      const b = Number.parseInt(hex.slice(5, 7), 16)
      return Math.abs(r - g) > 30 || Math.abs(g - b) > 30 || Math.abs(r - b) > 30
    })
    expect(hasChroma).toBe(true)
  })
}, 60000)
