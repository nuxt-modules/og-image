import type { H3Event } from '#nuxtseo/h3'
import { describe, expect, it, vi } from 'vitest'
import { getOgImagePath } from '../../src/runtime/server/utils'
import { decodeOgImageParams, signEncodedParams } from '../../src/runtime/shared'

vi.mock('#nuxtseo/nitro', () => ({
  useRuntimeConfig: (event: H3Event) => (event as any).__runtimeConfig,
}))

vi.mock('#og-image-virtual/component-names.mjs', () => ({
  componentNames: [],
}))

function fakeEvent({ baseURL = '/', secret = '', runtimeSecret = '', cloudflareSecret = '' } = {}): H3Event {
  return {
    __runtimeConfig: {
      'app': { baseURL },
      'nuxt-og-image': { defaults: {}, security: { strict: !!secret, secret } },
      'ogImage': { secret: runtimeSecret },
    },
    context: cloudflareSecret ? { cloudflare: { env: { NUXT_OG_IMAGE_SECRET: cloudflareSecret } } } : {},
  } as any as H3Event
}

function parseSigned(path: string) {
  const [, params, signature] = path.match(/\/_og\/d\/(.+),s_([\w-]+)\.png$/)!
  return { params, signature }
}

describe('getOgImagePath (Nitro)', () => {
  it('signs with the build-time secret', () => {
    const { path } = getOgImagePath(fakeEvent({ secret: 'build' }), '/blog/hello', { props: { title: 'Hello' } })

    const { params, signature } = parseSigned(path)
    expect(signature).toBe(signEncodedParams(params, 'build'))
    expect(decodeOgImageParams(params)._path).toBe('/blog/hello')
    expect(decodeOgImageParams(params).props.title).toBe('Hello')
  })

  it('prefers the runtime secret over the build-time secret', () => {
    const { path } = getOgImagePath(fakeEvent({ secret: 'build', runtimeSecret: 'runtime' }), '/')

    const { params, signature } = parseSigned(path)
    expect(signature).toBe(signEncodedParams(params, 'runtime'))
  })

  it('reads the Cloudflare env secret from the event', () => {
    const { path } = getOgImagePath(fakeEvent({ cloudflareSecret: 'cf' }), '/')

    const { params, signature } = parseSigned(path)
    expect(signature).toBe(signEncodedParams(params, 'cf'))
  })

  it('prefixes the app baseURL', () => {
    const { path } = getOgImagePath(fakeEvent({ baseURL: '/base/' }), '/about')

    expect(path).toMatch(/^\/base\/_og\/d\//)
  })

  it('stays unsigned without a secret', () => {
    const { path, hash } = getOgImagePath(fakeEvent(), '/about')

    expect(path).toMatch(/^\/_og\/d\/[^,]+\.png$/)
    expect(hash).toBeUndefined()
  })
})
