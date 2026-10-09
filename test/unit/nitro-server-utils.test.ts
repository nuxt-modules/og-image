import type { H3Event } from '#nuxtseo/h3'
import { describe, expect, it, vi } from 'vitest'
import { getOgImagePath } from '../../src/runtime/server/utils'
import { decodeOgImageParams, signEncodedParams } from '../../src/runtime/shared'

const runtime = vi.hoisted(() => ({ config: {} as Record<string, unknown> }))

vi.mock('nuxt/server', () => ({
  useRuntimeConfig: () => runtime.config,
}))

vi.mock('#og-image-virtual/component-names.mjs', () => ({
  componentNames: [],
}))

function fakeEvent({ baseURL = '/', secret = '' } = {}): H3Event {
  runtime.config = {
    'app': { baseURL },
    'nuxt-og-image': { defaults: {}, security: { strict: !!secret, secret } },
  }
  return {
    context: { _ogImageSigningSecret: secret },
  } as any as H3Event
}

function parseSigned(path: string) {
  const [, params, signature] = path.match(/\/_og\/d\/(.+),s_([\w-]+)\.png$/)!
  return { params, signature }
}

describe('getOgImagePath (Nitro)', () => {
  it('signs with the request-derived secret', () => {
    const { path } = getOgImagePath(fakeEvent({ secret: 'build' }), '/blog/hello', { props: { title: 'Hello' } })

    const { params, signature } = parseSigned(path)
    expect(signature).toBe(signEncodedParams(params, 'build'))
    expect(decodeOgImageParams(params)._path).toBe('/blog/hello')
    expect(decodeOgImageParams(params).props.title).toBe('Hello')
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
