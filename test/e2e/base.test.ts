import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

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

expect.extend({ toMatchImageSnapshot })

// Helper to extract og:image URL path from HTML (handles both absolute and relative URLs)
function extractOgImageUrl(html: string): string | null {
  const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
  if (!match?.[1])
    return null
  // Extract just the path from absolute URL (e.g., https://nuxtseo.com/_og/d/... -> /_og/d/...)
  try {
    const url = new URL(match[1])
    return url.pathname
  }
  catch {
    return match[1] // Already a relative path
  }
}

describe('build', () => {
  it.runIf(process.env.HAS_CHROME)('chromium tests', async () => {
    const html = await $fetch<string>('/prefix/chromium')
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    const chromium: ArrayBuffer = await $fetch(ogImageUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(chromium)).toMatchImageSnapshot()
  })

  it('static images', async () => {
    // Custom font page
    const customFontHtml = await $fetch<string>('/prefix/satori/custom-font')
    const customFontUrl = extractOgImageUrl(customFontHtml)
    expect(customFontUrl).toBeTruthy()
    const customFont: ArrayBuffer = await $fetch(customFontUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(customFont)).toMatchImageSnapshot()

    // Image page
    const imageHtml = await $fetch<string>('/prefix/satori/image')
    const imageUrl = extractOgImageUrl(imageHtml)
    expect(imageUrl).toBeTruthy()
    const image: ArrayBuffer = await $fetch(imageUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(image)).toMatchImageSnapshot()

    // Default satori page
    const defaultsHtml = await $fetch<string>('/prefix/satori')
    const defaultsUrl = extractOgImageUrl(defaultsHtml)
    expect(defaultsUrl).toBeTruthy()
    const defaults: ArrayBuffer = await $fetch(defaultsUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(defaults)).toMatchImageSnapshot()

    // Error page (404)
    const errorHtml = await $fetch<string>('/prefix/not-found').catch(() => '')
    const errorUrl = extractOgImageUrl(errorHtml)
    if (errorUrl) {
      const errorPageImage: ArrayBuffer = await $fetch(errorUrl, {
        responseType: 'arrayBuffer',
      })
      expect(Buffer.from(errorPageImage)).toMatchImageSnapshot()
    }
  }, 60000)

  it('dynamic images', async () => {
    // Inline route rules
    const inlineHtml = await $fetch<string>('/prefix/satori/route-rules/inline')
    const inlineUrl = extractOgImageUrl(inlineHtml)
    expect(inlineUrl).toBeTruthy()
    const inlineRouteRules: ArrayBuffer = await $fetch(inlineUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(inlineRouteRules)).toMatchImageSnapshot()

    // Config route rules
    const configHtml = await $fetch<string>('/prefix/satori/route-rules/config')
    const configUrl = extractOgImageUrl(configHtml)
    expect(configUrl).toBeTruthy()
    const overrideRouteRules: ArrayBuffer = await $fetch(configUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(overrideRouteRules)).toMatchImageSnapshot()

    // Global route rules
    const globalHtml = await $fetch<string>('/prefix/satori/route-rules')
    const globalUrl = extractOgImageUrl(globalHtml)
    expect(globalUrl).toBeTruthy()
    const globalRouteRules: ArrayBuffer = await $fetch(globalUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(globalRouteRules)).toMatchImageSnapshot()
  })
})
