import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { configureToMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/i18n'),
  server: true,
  build: true,
})

const toMatchImageSnapshot = configureToMatchImageSnapshot({
  failureThresholdType: 'percent',
  failureThreshold: 1,
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

describe('i18n integration', () => {
  describe('pattern 1: props-based (pass translated strings)', () => {
    it('english locale', async () => {
      const html = await $fetch('/') as string
      const ogImageUrl = extractOgImageUrl(html)
      expect(ogImageUrl).toBeTruthy()

      const image: ArrayBuffer = await $fetch(ogImageUrl!, {
        responseType: 'arrayBuffer',
      })
      expect(Buffer.from(image)).toMatchImageSnapshot()
    })

    it('spanish locale', async () => {
      const html = await $fetch('/es') as string
      const ogImageUrl = extractOgImageUrl(html)
      expect(ogImageUrl).toBeTruthy()

      const image: ArrayBuffer = await $fetch(ogImageUrl!, {
        responseType: 'arrayBuffer',
      })
      expect(Buffer.from(image)).toMatchImageSnapshot()
    })

    it('french locale', async () => {
      const html = await $fetch('/fr') as string
      const ogImageUrl = extractOgImageUrl(html)
      expect(ogImageUrl).toBeTruthy()

      const image: ArrayBuffer = await $fetch(ogImageUrl!, {
        responseType: 'arrayBuffer',
      })
      expect(Buffer.from(image)).toMatchImageSnapshot()
    })
  })

  describe('pattern 2: locale prop with loadLocaleMessages', () => {
    it('english locale', async () => {
      const html = await $fetch('/direct-i18n') as string
      const ogImageUrl = extractOgImageUrl(html)
      expect(ogImageUrl).toBeTruthy()

      const image: ArrayBuffer = await $fetch(ogImageUrl!, {
        responseType: 'arrayBuffer',
      })
      expect(Buffer.from(image)).toMatchImageSnapshot()
    })

    it('spanish locale', async () => {
      const html = await $fetch('/es/direct-i18n') as string
      const ogImageUrl = extractOgImageUrl(html)
      expect(ogImageUrl).toBeTruthy()

      const image: ArrayBuffer = await $fetch(ogImageUrl!, {
        responseType: 'arrayBuffer',
      })
      expect(Buffer.from(image)).toMatchImageSnapshot()
    })

    it('french locale', async () => {
      const html = await $fetch('/fr/direct-i18n') as string
      const ogImageUrl = extractOgImageUrl(html)
      expect(ogImageUrl).toBeTruthy()

      const image: ArrayBuffer = await $fetch(ogImageUrl!, {
        responseType: 'arrayBuffer',
      })
      expect(Buffer.from(image)).toMatchImageSnapshot()
    })
  })
})
