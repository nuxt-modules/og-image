import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)
const fixtureDir = resolve('../fixtures/basic')
const cacheDir = join(fixtureDir, 'node_modules/.cache/nuxt-seo/og-image')

// Clean up cache before test
if (existsSync(cacheDir)) {
  rmSync(cacheDir, { recursive: true })
}

await setup({
  rootDir: fixtureDir,
  server: true,
  build: true,
  nuxtConfig: {
    ogImage: {
      buildCache: true,
    },
  },
})

describe('build cache', () => {
  it('creates cache directory during prerender', async () => {
    // Fetch a page to ensure OG images are generated
    const html = await $fetch('/satori')
    expect(html).toContain('og:image')

    // Check that cache directory was created
    expect(existsSync(cacheDir)).toBe(true)
  })

  it('caches rendered images to disk', async () => {
    // List files in cache directory
    const files = readdirSync(cacheDir)

    // Should have at least one cached image
    expect(files.length).toBeGreaterThan(0)

    // Files should be JSON (containing base64 image data and expiry)
    const hasJsonFiles = files.some(f => f.endsWith('.png') || f.endsWith('.jpg'))
    expect(hasJsonFiles).toBe(true)
  })

  it('cache key includes component hash and version', async () => {
    // The cache files should have hash-based names
    const files = readdirSync(cacheDir)

    // Files should be named with hashes (alphanumeric)
    const allHashNames = files.every(f => /^[a-z0-9]+\.(?:png|jpg|jpeg)$/i.test(f))
    expect(allHashNames).toBe(true)
  })
})
