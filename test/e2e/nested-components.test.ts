import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { extractOgImageUrl, fetchOgImage } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/nested-components'),
  server: true,
  build: true,
  nuxtConfig: {
    sourcemap: false,
  },
})

describe('nested component resolution', () => {
  it('resolves nested component tailwind classes to inline styles', async () => {
    const html = await $fetch('/') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    const htmlPath = ogImageUrl!.replace(/\.png$/, '.html')
    const htmlPreview = await $fetch(htmlPath) as string

    expect(htmlPreview).toContain('Nested Test')
    expect(htmlPreview).toContain('Works!')
  }, 60000)

  it('renders a valid OG image with nested component', async () => {
    const image = await fetchOgImage('/')
    expect(image.byteLength).toBeGreaterThan(1000)
  }, 60000)
})
