import type { H3Event } from '#nuxtseo/h3'
import { describe, expect, it, vi } from 'vitest'
import { decodeOgImageParams, signEncodedParams } from '../../src/runtime/shared'

const runtimeConfig: Record<string, any> = {
  'app': {
    baseURL: '/',
  },
  'nuxt-og-image': {
    defaults: {},
    security: {
      strict: true,
      secret: 'test-secret-key',
    },
  },
  'ogImage': {
    secret: '',
  },
}

vi.mock('#nuxtseo/nitro', () => ({
  useRuntimeConfig: (event?: H3Event) => (event as any)?.__runtimeConfig ?? runtimeConfig,
}))

vi.mock('#og-image-virtual/component-names.mjs', () => ({
  componentNames: [],
}))

vi.mock('#nuxtseo/h3', () => ({
  getRequestURL: (event: H3Event) => new URL((event as any).__url),
}))

async function importNitroUtils() {
  return await import('../../src/runtime/server/nitro')
}

function fakeEvent(url: string, eventRuntimeConfig?: Record<string, any>): H3Event {
  return { __url: url, __runtimeConfig: eventRuntimeConfig } as any as H3Event
}

function parseSignedUrl(url: string) {
  const match = url.match(/^((?:https?:\/\/[^/]+)?)\/_og\/d\/(.+)\.png$/)
  expect(match, `expected a dynamic OG image URL, got ${url}`).toBeTruthy()
  const [, origin, segment] = match!
  const separatorIdx = segment.lastIndexOf(',s_')
  expect(separatorIdx, `expected a signed segment, got ${segment}`).toBeGreaterThan(-1)
  return {
    origin,
    params: segment.slice(0, separatorIdx),
    signature: segment.slice(separatorIdx + 3),
  }
}

function unsignedRuntimeConfig(): Record<string, any> {
  return {
    'app': { baseURL: '/' },
    'nuxt-og-image': { defaults: {}, security: { strict: false, secret: '' } },
    'ogImage': { secret: '' },
  }
}

describe('getOgImageUrl (Nitro)', () => {
  it('builds a signed dynamic URL path without an event', async () => {
    const { getOgImageUrl } = await importNitroUtils()

    const url = getOgImageUrl('/blog/hello', { props: { title: 'Hello World' } })

    const { origin, params, signature } = parseSignedUrl(url)
    expect(origin).toBe('')
    expect(signature).toBe(signEncodedParams(params, 'test-secret-key'))
    const decoded = decodeOgImageParams(params)
    expect(decoded._path).toBe('/blog/hello')
    expect(decoded.props.title).toBe('Hello World')
  })

  it('resolves an absolute URL from the request event', async () => {
    const { getOgImageUrl } = await importNitroUtils()

    const url = getOgImageUrl(
      '/blog/hello',
      { props: { title: 'Hello World' } },
      fakeEvent('https://example.com/blog/hello'),
    )

    const { origin, params, signature } = parseSignedUrl(url)
    expect(origin).toBe('https://example.com')
    expect(signature).toBe(signEncodedParams(params, 'test-secret-key'))
    expect(decodeOgImageParams(params)._path).toBe('/blog/hello')
  })

  it('prefixes the app baseURL', async () => {
    const { getOgImageUrl } = await importNitroUtils()

    const url = getOgImageUrl(
      '/about',
      {},
      fakeEvent('https://example.com/about', { ...runtimeConfig, app: { baseURL: '/base/' } }),
    )

    expect(url).toMatch(/^https:\/\/example\.com\/base\/_og\/d\//)
  })

  it('stays unsigned without a secret', async () => {
    const { getOgImageUrl } = await importNitroUtils()

    const url = getOgImageUrl(
      '/about',
      {},
      fakeEvent('https://example.com/about', unsignedRuntimeConfig()),
    )

    expect(url).toMatch(/^https:\/\/example\.com\/_og\/d\/[^,]+\.png$/)
    expect(url).not.toContain(',s_')
    const params = url.slice(url.lastIndexOf('/') + 1, -4)
    expect(decodeOgImageParams(params)._path).toBe('/about')
  })
})

describe('getOgImagePath (Nitro)', () => {
  it('returns the path and no hash for short URLs', async () => {
    const { getOgImagePath } = await import('../../src/runtime/server/utils')

    const result = getOgImagePath('/blog/hello')

    expect(result.path).toMatch(/^\/_og\/d\/.+/)
    expect(result.path.endsWith('.png')).toBe(true)
    expect(result.hash).toBeUndefined()
  })
})
