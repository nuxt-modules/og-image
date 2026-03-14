import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'
import { fetchOgImages } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/build-transforms'),
  server: true,
  build: true,
})

expect.extend({ toMatchImageSnapshot })

describe('build-time transforms', () => {
  it('should render OG images with inlined icons, images, and combined', async () => {
    const images = await fetchOgImages('/', '/image-test', '/combined-test')

    expect(images.get('/')!.byteLength).toBeGreaterThan(1000)
    expect(images.get('/')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'build-transforms-icon-test',
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })

    expect(images.get('/image-test')!.byteLength).toBeGreaterThan(1000)
    expect(images.get('/image-test')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'build-transforms-image-test',
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })

    expect(images.get('/combined-test')!.byteLength).toBeGreaterThan(1000)
    expect(images.get('/combined-test')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'build-transforms-combined-test',
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })
  }, 60000)
})
