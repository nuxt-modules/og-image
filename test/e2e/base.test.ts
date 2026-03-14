import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { extractOgImageUrl, fetchOgImages, setupImageSnapshots, SNAPSHOT_LOOSE } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
  nuxtConfig: {
    app: {
      baseURL: '/prefix/',
    },
  },
})

setupImageSnapshots(SNAPSHOT_LOOSE)

describe('build', () => {
  it.runIf(process.env.HAS_CHROME)('browser tests', async () => {
    const images = await fetchOgImages('/prefix/browser')
    expect(images.get('/prefix/browser')).toMatchImageSnapshot()
  })

  it('static images', async () => {
    const images = await fetchOgImages(
      '/prefix/satori/custom-font',
      '/prefix/satori/image',
      '/prefix/satori',
    )
    expect(images.get('/prefix/satori/custom-font')).toMatchImageSnapshot()
    expect(images.get('/prefix/satori/image')).toMatchImageSnapshot()
    expect(images.get('/prefix/satori')).toMatchImageSnapshot()

    // Error page (404) — handled separately since it may not have og:image
    const errorHtml = await $fetch('/prefix/not-found').catch(() => '') as string
    const errorUrl = extractOgImageUrl(errorHtml)
    if (errorUrl) {
      const errorPageImage: ArrayBuffer = await $fetch(errorUrl, {
        responseType: 'arrayBuffer',
      })
      expect(Buffer.from(errorPageImage)).toMatchImageSnapshot()
    }
  }, 60000)

  it('dynamic images', async () => {
    const images = await fetchOgImages(
      '/prefix/satori/route-rules/inline',
      '/prefix/satori/route-rules/config',
      '/prefix/satori/route-rules',
    )
    expect(images.get('/prefix/satori/route-rules/inline')).toMatchImageSnapshot()
    expect(images.get('/prefix/satori/route-rules/config')).toMatchImageSnapshot()
    expect(images.get('/prefix/satori/route-rules')).toMatchImageSnapshot()
  })
})
