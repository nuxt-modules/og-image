import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { fetchOgImages, setupImageSnapshots, SNAPSHOT_LOOSE } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/i18n'),
  server: true,
  build: true,
})

setupImageSnapshots(SNAPSHOT_LOOSE)

describe('i18n integration', () => {
  it('props-based locales render correctly', async () => {
    const images = await fetchOgImages('/', '/es', '/fr')
    expect(images.get('/')).toMatchImageSnapshot()
    expect(images.get('/es')).toMatchImageSnapshot()
    expect(images.get('/fr')).toMatchImageSnapshot()
  })

  it('loadLocaleMessages locales render correctly', async () => {
    const images = await fetchOgImages('/direct-i18n', '/es/direct-i18n', '/fr/direct-i18n')
    expect(images.get('/direct-i18n')).toMatchImageSnapshot()
    expect(images.get('/es/direct-i18n')).toMatchImageSnapshot()
    expect(images.get('/fr/direct-i18n')).toMatchImageSnapshot()
  })
})
