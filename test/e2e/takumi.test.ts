import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

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

expect.extend({ toMatchImageSnapshot })

function extractOgImageUrl(html: string): string | null {
  const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
  if (!match?.[1])
    return null
  try {
    const url = new URL(match[1])
    return url.pathname
  }
  catch {
    return match[1]
  }
}

describe('takumi renderer', () => {
  it.runIf(hasTakumi)('renders basic takumi image', async () => {
    const html = await $fetch('/prefix/takumi') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    const image: ArrayBuffer = await $fetch(ogImageUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(image)).toMatchImageSnapshot()
  }, 60000)

  it.runIf(!hasTakumi)('skips takumi tests when @takumi-rs/core not installed', () => {
    console.log('Skipping takumi tests - @takumi-rs/core not installed')
    expect(true).toBe(true)
  })
})

describe('renderer comparison', () => {
  it.runIf(hasTakumi)('simple component - satori vs takumi', async () => {
    // Render with satori
    const satoriHtml = await $fetch('/prefix/comparison/satori') as string
    const satoriUrl = extractOgImageUrl(satoriHtml)
    expect(satoriUrl).toBeTruthy()
    const satoriImage: ArrayBuffer = await $fetch(satoriUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(satoriImage)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-simple-satori',
    })

    // Render with takumi
    const takumiHtml = await $fetch('/prefix/comparison/takumi') as string
    const takumiUrl = extractOgImageUrl(takumiHtml)
    expect(takumiUrl).toBeTruthy()
    const takumiImage: ArrayBuffer = await $fetch(takumiUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(takumiImage)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-simple-takumi',
    })
  }, 60000)

  // Skip NuxtSeo - uses hash-based URLs only supported during prerendering
  it.skip('NuxtSeo template - satori vs takumi', async () => {
    // Render with satori
    const satoriHtml = await $fetch('/prefix/comparison/nuxtseo-satori') as string
    const satoriUrl = extractOgImageUrl(satoriHtml)
    expect(satoriUrl).toBeTruthy()
    const satoriImage: ArrayBuffer = await $fetch(satoriUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(satoriImage)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-nuxtseo-satori',
    })

    // Render with takumi
    const takumiHtml = await $fetch('/prefix/comparison/nuxtseo-takumi') as string
    const takumiUrl = extractOgImageUrl(takumiHtml)
    expect(takumiUrl).toBeTruthy()
    const takumiImage: ArrayBuffer = await $fetch(takumiUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(takumiImage)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'comparison-nuxtseo-takumi',
    })
  }, 60000)
})
