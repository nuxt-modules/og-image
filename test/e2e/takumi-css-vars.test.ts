import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { fetchOgImage, setupImageSnapshots, SNAPSHOT_LOOSE } from '../utils'

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

// Regression test: CSS var() references should render correctly.
// PR #498 introduced a bug where var() values were silently dropped.
// The satori vs takumi comparison is in takumi.test.ts — this tests
// satori-only to catch regressions even without takumi installed.
describe('css vars regression', () => {
  it('satori renders CSS var() references', async () => {
    const image = await fetchOgImage('/prefix/satori/css-vars')
    expect(image.byteLength).toBeGreaterThan(1000)
    expect(image).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-css-vars-satori',
    })
  }, 60000)
})
