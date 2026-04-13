import { createResolver } from '@nuxt/kit'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

// Exercises the resolver under a non-root baseURL AND with security config
// enabled, so the origin check / query-size cap / path-length cap code paths
// are actually covered.
await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
  nuxtConfig: {
    app: {
      baseURL: '/prefix/',
    },
    ogImage: {
      security: {
        maxQueryParamSize: 32,
      },
    },
  },
})

describe('/_og/r resolver (baseURL + security)', () => {
  it('resolves under a non-root baseURL', async () => {
    const res = await fetch('/prefix/_og/r/satori', { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBeTruthy()
  }, 60000)

  it('rejects query strings over maxQueryParamSize', async () => {
    const longQuery = `?${'x'.repeat(64)}=1`
    const res = await fetch(`/prefix/_og/r/satori${longQuery}`, { redirect: 'manual' })
    expect(res.status).toBe(400)
  })

  it('rejects paths over the 2048-char cap', async () => {
    const longPath = `/prefix/_og/r/${'a'.repeat(2100)}`
    const res = await fetch(longPath, { redirect: 'manual' })
    expect(res.status).toBe(400)
  })
})
