import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
})

expect.extend({ toMatchImageSnapshot })

// Helper to extract og:image URL from HTML
function extractOgImageUrl(html: string): string | null {
  const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
  return match?.[1] || null
}

describe('build', () => {
  it.runIf(process.env.HAS_CHROME)('chromium tests', async () => {
    const html = await $fetch<string>('/chromium')
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    const chromium: ArrayBuffer = await $fetch(ogImageUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(chromium)).toMatchImageSnapshot()
  })

  it('static images', async () => {
    const customFontHtml = await $fetch<string>('/satori/custom-font')
    const customFontUrl = extractOgImageUrl(customFontHtml)
    expect(customFontUrl).toBeTruthy()
    const customFont: ArrayBuffer = await $fetch(customFontUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(customFont)).toMatchImageSnapshot()

    const imageHtml = await $fetch<string>('/satori/image')
    const imageUrl = extractOgImageUrl(imageHtml)
    expect(imageUrl).toBeTruthy()
    const image: ArrayBuffer = await $fetch(imageUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(image)).toMatchImageSnapshot()

    const defaultsHtml = await $fetch<string>('/satori')
    const defaultsUrl = extractOgImageUrl(defaultsHtml)
    expect(defaultsUrl).toBeTruthy()
    const defaults: ArrayBuffer = await $fetch(defaultsUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(defaults)).toMatchImageSnapshot()
  }, 60000)

  it('dynamic images', async () => {
    const inlineHtml = await $fetch<string>('/satori/route-rules/inline')
    const inlineUrl = extractOgImageUrl(inlineHtml)
    expect(inlineUrl).toBeTruthy()
    const inlineRouteRules: ArrayBuffer = await $fetch(inlineUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(inlineRouteRules)).toMatchImageSnapshot()

    const configHtml = await $fetch<string>('/satori/route-rules/config')
    const configUrl = extractOgImageUrl(configHtml)
    expect(configUrl).toBeTruthy()
    const overrideRouteRules: ArrayBuffer = await $fetch(configUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(overrideRouteRules)).toMatchImageSnapshot()

    const globalHtml = await $fetch<string>('/satori/route-rules')
    const globalUrl = extractOgImageUrl(globalHtml)
    expect(globalUrl).toBeTruthy()
    const globalRouteRules: ArrayBuffer = await $fetch(globalUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(globalRouteRules)).toMatchImageSnapshot()
  })
})
