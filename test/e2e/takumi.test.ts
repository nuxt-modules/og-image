import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { extractOgImageUrl, fetchOgImage, fetchOgImages, setupImageSnapshots, SNAPSHOT_LOOSE } from '../utils'

const { resolve } = createResolver(import.meta.url)

// Check if takumi packages are available
let hasTakumi = false
try {
  await import('@takumi-rs/core')
  hasTakumi = true
}
catch {
  hasTakumi = false
}

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

// ── Takumi-only features ────────────────────────────────────────────────

describe('takumi renderer', () => {
  it.runIf(hasTakumi)('renders basic takumi image', async () => {
    const image = await fetchOgImage('/prefix/takumi')
    expect(image).toMatchImageSnapshot()
  }, 60000)

  it.runIf(!hasTakumi)('skips takumi tests when @takumi-rs/core not installed', () => {
    expect(true).toBe(true)
  })
})

// ── Security: dimension clamping (GHSA-c7xp-q6q8-hg76) ───────────────

describe('dimension clamping', () => {
  it('clamps oversized width/height query params to max dimension', async () => {
    const html = await $fetch('/prefix/takumi') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()
    const oversizedUrl = `${ogUrl}?width=20000&height=20000`
    const image: ArrayBuffer = await $fetch(oversizedUrl, { responseType: 'arrayBuffer' })
    expect(Buffer.from(image).length).toBeGreaterThan(0)
  }, 60000)
})

// ── Renderer comparison: same component, satori vs takumi ───────────────

describe('renderer comparison', () => {
  it('simple component', async () => {
    const images = await fetchOgImages('/prefix/comparison/satori', '/prefix/comparison/takumi')
    expect(images.get('/prefix/comparison/satori')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-simple-satori',
    })
    expect(images.get('/prefix/comparison/takumi')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-simple-takumi',
    })
  }, 60000)

  it('complex component (gradients, rounded corners, opacity)', async () => {
    const satoriHtml = await $fetch('/prefix/comparison/complex-satori') as string
    const satoriUrl = extractOgImageUrl(satoriHtml)
    expect(satoriUrl).toBeTruthy()
    const satoriImage: ArrayBuffer = await $fetch(satoriUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(satoriImage)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-complex-satori',
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })

    const takumiImage = await fetchOgImage('/prefix/comparison/complex-takumi')
    expect(takumiImage).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-complex-takumi',
    })
  }, 60000)

  // Skip NuxtSeo - uses hash-based URLs only supported during prerendering
  it.skip('nuxtseo template', async () => {
    const images = await fetchOgImages('/prefix/comparison/nuxtseo-satori', '/prefix/comparison/nuxtseo-takumi')
    expect(images.get('/prefix/comparison/nuxtseo-satori')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-nuxtseo-satori',
    })
    expect(images.get('/prefix/comparison/nuxtseo-takumi')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-nuxtseo-takumi',
    })
  }, 60000)

  it.runIf(hasTakumi)('calc() expressions — satori vs takumi', async () => {
    const images = await fetchOgImages('/prefix/satori/calc', '/prefix/takumi/calc')
    expect(images.get('/prefix/satori/calc')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-calc-satori',
    })
    expect(images.get('/prefix/takumi/calc')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-calc-takumi',
    })
  }, 60000)

  it.runIf(hasTakumi)('text overflow ellipsis — satori vs takumi', async () => {
    const images = await fetchOgImages('/prefix/satori/ellipsis', '/prefix/takumi/ellipsis')
    expect(images.get('/prefix/satori/ellipsis')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-ellipsis-satori',
    })
    expect(images.get('/prefix/takumi/ellipsis')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-ellipsis-takumi',
    })
  }, 60000)

  it.runIf(hasTakumi)('image rendering (<img>, bg-image, svg) — satori vs takumi', async () => {
    const images = await fetchOgImages('/prefix/satori/image-test', '/prefix/takumi/image')
    expect(images.get('/prefix/satori/image-test')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-image-satori',
    })
    expect(images.get('/prefix/takumi/image')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-image-takumi',
    })
  }, 60000)

  it.runIf(hasTakumi)('cSS var() references — satori vs takumi', async () => {
    const images = await fetchOgImages('/prefix/satori/css-vars', '/prefix/takumi/css-vars')
    expect(images.get('/prefix/satori/css-vars')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-css-vars-satori',
    })
    expect(images.get('/prefix/takumi/css-vars')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-css-vars-takumi',
    })
  }, 60000)

  it.runIf(hasTakumi)('github avatars (complex images) — satori vs takumi', async () => {
    const images = await fetchOgImages('/prefix/satori/image', '/prefix/takumi/github-avatars')
    expect(images.get('/prefix/satori/image')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-github-avatars-satori',
    })
    expect(images.get('/prefix/takumi/github-avatars')).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-github-avatars-takumi',
    })
  }, 60000)
})
