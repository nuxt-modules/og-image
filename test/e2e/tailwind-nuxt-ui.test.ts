import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import getColors from 'get-image-colors'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/tailwind-nuxt-ui'),
  server: true,
  build: true,
})

expect.extend({ toMatchImageSnapshot })

describe('tailwind-nuxt-ui', () => {
  it('renders og image with nuxt ui semantic colors', async () => {
    // Fetch the page HTML
    const html = await $fetch('/') as string
    expect(html).toContain('og:image')

    // Extract og:image URL
    const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
      || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
    expect(match?.[1]).toBeTruthy()

    // Get base URL without extension
    const ogUrl = new URL(match![1]!)
    const basePath = ogUrl.pathname

    // Test PNG endpoint with custom name
    const png: ArrayBuffer = await $fetch(basePath, { responseType: 'arrayBuffer' })
    expect(Buffer.from(png)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'nuxt-ui-semantic-colors',
      failureThreshold: 1,
      failureThresholdType: 'percent',
    })
  })

  it('renders html preview with nuxt ui colors', async () => {
    const html = await $fetch('/') as string
    const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
      || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
    const ogUrl = new URL(match![1]!)

    // Replace extension with .html
    const htmlPath = ogUrl.pathname.replace(/\.png$/, '.html')
    const htmlPreview = await $fetch(htmlPath) as string
    expect(htmlPreview).toContain('Nuxt UI Colors')
    // Verify colors are resolved to inline styles with hex values (TW4 transform + oklch conversion)
    expect(htmlPreview).toMatch(/style="[^"]*background-color:\s*#/)

    // Verify user's app.config.ts override (primary: 'indigo') was applied, not the default green.
    // Extract all background-color hex values from the preview.
    const bgColors = [...htmlPreview.matchAll(/background-color:\s*#([0-9a-f]{6})/gi)].map(m => m[1]!)
    expect(bgColors.length).toBeGreaterThan(0)
    // Indigo has a dominant blue channel (e.g. #6366f1), green has a dominant green channel (e.g. #22c55e).
    // At least one bg-primary element should resolve to a blue-dominant color (indigo).
    const hasIndigo = bgColors.some((hex) => {
      const r = Number.parseInt(hex.slice(0, 2), 16)
      const g = Number.parseInt(hex.slice(2, 4), 16)
      const b = Number.parseInt(hex.slice(4, 6), 16)
      return b > r && b > g // blue-dominant = indigo family
    })
    expect(hasIndigo, `expected indigo (blue-dominant) bg-primary, got hex colors: ${bgColors.map(h => `#${h}`).join(', ')}`).toBe(true)
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

    // Verify colors aren't all grayscale (actual colors resolved)
    const hasChroma = hexColors.some((hex) => {
      const r = Number.parseInt(hex.slice(1, 3), 16)
      const g = Number.parseInt(hex.slice(3, 5), 16)
      const b = Number.parseInt(hex.slice(5, 7), 16)
      // Non-gray: channels differ by more than 30
      return Math.abs(r - g) > 30 || Math.abs(g - b) > 30 || Math.abs(r - b) > 30
    })
    expect(hasChroma).toBe(true)
  })

  it('renders og image with nuxt ui components', async () => {
    const html = await $fetch('/components') as string
    expect(html).toContain('og:image')

    const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
      || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
    expect(match?.[1]).toBeTruthy()

    const ogUrl = new URL(match![1]!)
    const basePath = ogUrl.pathname

    const png: ArrayBuffer = await $fetch(basePath, { responseType: 'arrayBuffer' })
    expect(Buffer.from(png)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'nuxt-ui-components',
      failureThreshold: 1,
      failureThresholdType: 'percent',
    })
  })

  it('renders html preview with nuxt ui components', async () => {
    const html = await $fetch('/components') as string
    const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
      || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
    const ogUrl = new URL(match![1]!)

    const htmlPath = ogUrl.pathname.replace(/\.png$/, '.html')
    const htmlPreview = await $fetch(htmlPath) as string

    // Verify component rendered with expected content
    expect(htmlPreview).toContain('UI Components Test')
    // Verify Nuxt UI components are rendered
    expect(htmlPreview).toContain('Primary')
  })
}, 60000)
