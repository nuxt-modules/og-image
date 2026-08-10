import { readdirSync, readFileSync } from 'node:fs'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { extractOgImageUrl, fetchOgImages, setupImageSnapshots, SNAPSHOT_STRICT } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/woff2-conversion'),
  server: true,
  build: true,
})

setupImageSnapshots(SNAPSHOT_STRICT)

describe('nuxt Fonts WOFF2 conversion', () => {
  const convertedFilename = 'noto-sans-sc-100-400-normal.ttf'

  it('reuses the configured CJK subset without downloading a full fallback', () => {
    const ctx = useTestContext()
    const staticFontDir = join(ctx.nuxt!.options.buildDir, 'cache', 'og-image', 'static-fonts')
    const font = readFileSync(join(staticFontDir, convertedFilename))

    expect(font.subarray(0, 4)).toEqual(Buffer.from([0, 1, 0, 0]))
    expect(font.byteLength).toBeLessThan(100_000)
    expect(readdirSync(staticFontDir).filter(filename => filename.startsWith('Noto_Sans_SC-'))).toEqual([])
  })

  it('serves converted assets from the static font route', async () => {
    const font = await $fetch(`/_og-static-fonts/${convertedFilename}`, { responseType: 'arrayBuffer' }) as ArrayBuffer
    expect(Buffer.from(font).subarray(0, 4)).toEqual(Buffer.from([0, 1, 0, 0]))
  })

  it('renders the configured CJK subset with both renderers', async () => {
    const pages = await Promise.all([$fetch('/') as Promise<string>, $fetch('/takumi') as Promise<string>])
    expect(extractOgImageUrl(pages[0])).not.toBe(extractOgImageUrl(pages[1]))

    const images = await fetchOgImages('/', '/takumi')
    expect(images.get('/')).toMatchImageSnapshot({ customSnapshotIdentifier: 'woff2-subset-satori' })
    expect(images.get('/takumi')).toMatchImageSnapshot({ customSnapshotIdentifier: 'woff2-subset-takumi' })
  })
})
