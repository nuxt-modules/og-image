import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/nuxt-fonts-integration'),
  server: true,
  build: true,
})

describe('@nuxt/fonts integration', () => {
  it('font endpoint serves Inter from @nuxt/fonts config', async () => {
    const font = await $fetch('/_og/f/Inter/400', { responseType: 'arrayBuffer' })
    expect(font).toBeDefined()
    expect(font.byteLength).toBeGreaterThan(1000) // font should have data
  }, 60000)

  it('font endpoint serves Roboto from @nuxt/fonts config', async () => {
    const font = await $fetch('/_og/f/Roboto/400', { responseType: 'arrayBuffer' })
    expect(font).toBeDefined()
    expect(font.byteLength).toBeGreaterThan(1000)
  }, 60000)

  it('font endpoint serves different weights', async () => {
    const inter700 = await $fetch('/_og/f/Inter/700', { responseType: 'arrayBuffer' })
    expect(inter700).toBeDefined()
    expect(inter700.byteLength).toBeGreaterThan(1000)
  }, 60000)

  it('og:image meta tag is present on page', async () => {
    const html = await $fetch('/') as string
    expect(html).toContain('og:image')
  }, 60000)
})
