import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import getColors from 'get-image-colors'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'
import { extractOgImageUrl, fetchOgImage } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/tailwind-nuxt-ui'),
  server: true,
  build: true,
})

expect.extend({ toMatchImageSnapshot })

describe('tailwind-nuxt-ui', () => {
  it('renders og image with nuxt ui semantic colors', async () => {
    const image = await fetchOgImage('/')
    expect(image).toMatchImageSnapshot({
      customSnapshotIdentifier: 'nuxt-ui-semantic-colors',
      failureThreshold: 1,
      failureThresholdType: 'percent',
    })
  })

  it('renders html preview with nuxt ui colors', async () => {
    const html = await $fetch('/') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()

    const htmlPath = ogUrl!.replace(/\.png$/, '.html')
    const htmlPreview = await $fetch(htmlPath) as string
    expect(htmlPreview).toContain('Nuxt UI Colors')
    expect(htmlPreview).toMatch(/style="[^"]*background-color:\s*#/)

    const bgColors = Array.from(htmlPreview.matchAll(/background-color:\s*#([0-9a-f]{6})/gi), m => m[1]!)
    expect(bgColors.length).toBeGreaterThan(0)
    const hasIndigo = bgColors.some((hex) => {
      const r = Number.parseInt(hex.slice(0, 2), 16)
      const g = Number.parseInt(hex.slice(2, 4), 16)
      const b = Number.parseInt(hex.slice(4, 6), 16)
      return b > r && b > g
    })
    expect(hasIndigo, `expected indigo (blue-dominant) bg-primary, got hex colors: ${bgColors.map(h => `#${h}`).join(', ')}`).toBe(true)
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

  it('renders og image with nuxt ui components', async () => {
    const image = await fetchOgImage('/components')
    expect(image).toMatchImageSnapshot({
      customSnapshotIdentifier: 'nuxt-ui-components',
      failureThreshold: 1,
      failureThresholdType: 'percent',
    })
  })

  it('renders inverted tokens snapshot for light colorMode', async () => {
    const image = await fetchOgImage('/inverted-light')
    expect(image).toMatchImageSnapshot({
      customSnapshotIdentifier: 'nuxt-ui-inverted-light',
      failureThreshold: 1,
      failureThresholdType: 'percent',
    })
  })

  it('renders inverted tokens snapshot for dark colorMode', async () => {
    const image = await fetchOgImage('/inverted-dark')
    expect(image).toMatchImageSnapshot({
      customSnapshotIdentifier: 'nuxt-ui-inverted-dark',
      failureThreshold: 1,
      failureThresholdType: 'percent',
    })
  })

  it('swaps bg-inverted/text-inverted tokens based on colorMode prop', async () => {
    // Build emits paired light/dark arbitrary classes when root has :data-theme binding.
    // Verify the build-time output then assert rendered image colors differ.
    const html = await $fetch('/inverted-light') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()
    const preview = await $fetch(ogUrl!.replace(/\.png$/, '.html')) as string
    expect(preview, 'preview should contain paired light/dark token classes')
      .toMatch(/bg-\[#[0-9a-f]+\]\s+dark:bg-\[#[0-9a-f]+\]/i)
    expect(preview, 'preview should contain paired light/dark text classes')
      .toMatch(/text-\[#[0-9a-f]+\]\s+dark:text-\[#[0-9a-f]+\]/i)

    // Rendered images for light vs dark colorMode must differ
    const lightImage = await fetchOgImage('/inverted-light')
    const darkImage = await fetchOgImage('/inverted-dark')
    const lightColors = (await getColors(lightImage, 'image/png')).map(c => c.hex().toLowerCase()).sort()
    const darkColors = (await getColors(darkImage, 'image/png')).map(c => c.hex().toLowerCase()).sort()
    expect(lightColors.join(','), 'light colorMode palette should differ from dark').not.toBe(darkColors.join(','))
  })

  it('renders html preview with nuxt ui components', async () => {
    const html = await $fetch('/components') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()

    const htmlPath = ogUrl!.replace(/\.png$/, '.html')
    const htmlPreview = await $fetch(htmlPath) as string

    expect(htmlPreview).toContain('UI Components Test')
    expect(htmlPreview).toContain('Primary')
  })
}, 60000)
