import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { extractOgImageUrl } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
})

describe('cache query params', () => {
  it('encodes page query param as title in OG image URL', async () => {
    const html = await $fetch('/satori/query-param?title=Hello') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()
    expect(ogUrl).toContain('Hello')
  }, 60000)

  it('different query param values produce different OG image URLs', async () => {
    const html1 = await $fetch('/satori/query-param?title=First') as string
    const html2 = await $fetch('/satori/query-param?title=Second') as string
    const url1 = extractOgImageUrl(html1)
    const url2 = extractOgImageUrl(html2)
    expect(url1).toBeTruthy()
    expect(url2).toBeTruthy()
    expect(url1).not.toBe(url2)
    expect(url1).toContain('First')
    expect(url2).toContain('Second')
  }, 60000)

  it('uses default title when no query param provided', async () => {
    const html = await $fetch('/satori/query-param') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()
    expect(ogUrl).toContain('Default')
  }, 60000)

  it('same query param value produces identical OG image URLs', async () => {
    const html1 = await $fetch('/satori/query-param?title=Stable') as string
    const html2 = await $fetch('/satori/query-param?title=Stable') as string
    const url1 = extractOgImageUrl(html1)
    const url2 = extractOgImageUrl(html2)
    expect(url1).toBe(url2)
  }, 60000)

  it('extra page query params are encoded in OG image URL via _query', async () => {
    // The full page query string is encoded into the OG image URL,
    // because the page may render differently with different query params
    const html1 = await $fetch('/satori/query-param?title=Same&ref=twitter') as string
    const html2 = await $fetch('/satori/query-param?title=Same&utm_source=og') as string
    const url1 = extractOgImageUrl(html1)
    const url2 = extractOgImageUrl(html2)
    expect(url1).not.toBe(url2)
    expect(url1).toContain('Same')
    expect(url2).toContain('Same')
  }, 60000)
})
