import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { fetchOgImages, setupImageSnapshots, SNAPSHOT_DEFAULT } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
})

setupImageSnapshots(SNAPSHOT_DEFAULT)

describe('build', () => {
  it.runIf(process.env.HAS_CHROME)('browser tests', async () => {
    const images = await fetchOgImages('/browser')
    expect(images.get('/browser')).toMatchImageSnapshot()
  })

  it('static images', async () => {
    const images = await fetchOgImages(
      '/satori/custom-font',
      '/satori/image',
      '/satori',
    )
    expect(images.get('/satori/custom-font')).toMatchImageSnapshot()
    expect(images.get('/satori/image')).toMatchImageSnapshot()
    expect(images.get('/satori')).toMatchImageSnapshot()
  }, 60000)

  it('dynamic images', async () => {
    const images = await fetchOgImages(
      '/satori/route-rules/inline',
      '/satori/route-rules/config',
      '/satori/route-rules',
    )
    expect(images.get('/satori/route-rules/inline')).toMatchImageSnapshot()
    expect(images.get('/satori/route-rules/config')).toMatchImageSnapshot()
    expect(images.get('/satori/route-rules')).toMatchImageSnapshot()
  })
})
