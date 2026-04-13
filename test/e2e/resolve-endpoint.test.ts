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

describe('/_og/r resolver endpoint', () => {
  it('302 redirects to the page\'s resolved og:image', async () => {
    const pagePath = '/satori'
    const pageHtml = await $fetch(pagePath) as string
    const expected = extractOgImageUrl(pageHtml)
    expect(expected).toBeTruthy()

    const res = await fetch(`/_og/r${pagePath}`, { redirect: 'manual' })
    expect(res.status).toBe(302)
    const location = res.headers.get('location')
    expect(location).toBeTruthy()
    const locationPath = location!.startsWith('http')
      ? new URL(location!).pathname
      : (location!.split('?')[0] ?? location!)
    expect(locationPath).toBe(expected)
  }, 60000)

  it('strips trailing image extension alias', async () => {
    const res = await fetch('/_og/r/satori.png', { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBeTruthy()
  }, 60000)

  // The core user-facing scenario from issue #571: a blog/listing page needs
  // stable URLs pointing at the og:image of other pages so it can render
  // image cards without knowing each page's encoded image URL.
  it('resolves distinct og:image URLs for different pages (listing-page use case)', async () => {
    const pages = ['/satori', '/satori/computed', '/satori/seo-meta-inject']
    const results = await Promise.all(pages.map(async (p) => {
      const res = await fetch(`/_og/r${p}`, { redirect: 'manual' })
      return { page: p, status: res.status, location: res.headers.get('location') }
    }))

    for (const r of results) {
      expect(r.status, `resolver for ${r.page}`).toBe(302)
      expect(r.location, `location for ${r.page}`).toBeTruthy()
    }
    // Each page declares its own og:image via defineOgImage; the redirect
    // targets must differ page-to-page (modulo query, strip it before compare).
    const paths = results.map(r => (r.location!.split('?')[0] ?? r.location!))
    expect(new Set(paths).size).toBe(pages.length)
  }, 60000)

  it('rejects resolving internal routes', async () => {
    const res = await fetch('/_og/r/_og/d/foo.png', { redirect: 'manual' })
    expect(res.status).toBe(400)
  })

  it('rejects protocol-relative paths (SSRF guard)', async () => {
    const res = await fetch('/_og/r//evil.example.com/x', { redirect: 'manual' })
    expect(res.status).toBe(400)
  })

  it('rejects paths containing a scheme', async () => {
    // ufo normalises, so test by injecting via the URL encoded form
    const res = await fetch('/_og/r/http%3A//evil.example.com/x', { redirect: 'manual' })
    // Either rejected by the scheme guard (400) or fails to find a page (502/404).
    expect([400, 404, 502]).toContain(res.status)
  })
})
