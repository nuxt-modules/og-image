import { createResolver } from '@nuxt/kit'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { extractOgImageUrl } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
})

describe('page query params in OG image URLs', () => {
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

describe('cache headers', () => {
  it('dynamic OG image sets correct cache headers on miss', async () => {
    const html = await $fetch('/satori/query-param?title=CacheTest') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()

    const res = await fetch(ogUrl!)
    expect(res.headers.get('cache-control')).toMatchInlineSnapshot(`"public, max-age=259200, s-maxage=259200, stale-while-revalidate=259200, stale-if-error=259200"`)
    expect(res.headers.get('x-og-cache')).toMatchInlineSnapshot(`"MISS"`)
    expect(res.headers.get('etag')).toBeTruthy()
    expect(res.headers.get('last-modified')).toBeTruthy()
    expect(res.headers.get('vary')).toMatchInlineSnapshot(`"accept-encoding, host"`)
  }, 60000)

  it('dynamic OG image returns HIT on second request', async () => {
    const html = await $fetch('/satori/query-param?title=HitTest') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()

    // First request populates cache
    await fetch(ogUrl!)
    // Second request should hit
    const res = await fetch(ogUrl!)
    expect(res.headers.get('x-og-cache')).toMatchInlineSnapshot(`"HIT"`)
  }, 60000)

  it('prerendered OG image has immutable cache headers', async () => {
    // /satori/ is in the prerender routes list, so its OG image is at /_og/s/
    const html = await $fetch('/satori/') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()
    expect(ogUrl).toContain('/_og/s/')

    const res = await fetch(ogUrl!)
    expect(res.headers.get('cache-control')).toMatchInlineSnapshot(`"public, max-age=31536000, immutable"`)
  }, 60000)
})
