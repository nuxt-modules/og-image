import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'
import { fetchOgImages } from '../utils'

const { resolve } = createResolver(import.meta.url)

let hasTakumi = false
try {
  await import('@takumi-rs/core')
  hasTakumi = true
}
catch {
  hasTakumi = false
}

await setup({
  rootDir: resolve('../fixtures/emojis'),
  server: true,
  build: true,
})

expect.extend({ toMatchImageSnapshot })

describe('local emoji rendering', () => {
  it('satori: renders emoji OG images', async () => {
    const images = await fetchOgImages('/', '/alt-text-test', '/dynamic-emoji')

    expect(images.get('/')!.byteLength).toBeGreaterThan(1000)
    expect(images.get('/')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'local-emoji-index-page',
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })

    expect(images.get('/alt-text-test')!.byteLength).toBeGreaterThan(1000)
    expect(images.get('/alt-text-test')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'local-emoji-alt-text-test',
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })

    expect(images.get('/dynamic-emoji')!.byteLength).toBeGreaterThan(1000)
  }, 60000)

  // Regression: #497 — satori-specific margin/vertical-align styles on emoji SVGs
  // caused skewing when rendered by takumi. The fix removes satori-specific styles
  // from getEmojiSvg() (shared) and keeps them in the satori vnode plugin only.
  it.runIf(hasTakumi)('takumi: renders emojis without skewing', async () => {
    const images = await fetchOgImages('/takumi')
    expect(images.get('/takumi')!.byteLength).toBeGreaterThan(1000)
    expect(images.get('/takumi')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'local-emoji-takumi',
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })
  }, 60000)
})
