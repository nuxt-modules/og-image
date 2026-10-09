import { hkdfSync } from 'node:crypto'
import { createResolver, useNuxt } from '@nuxt/kit'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { decodeOgImageParams, signEncodedParams } from '../../src/runtime/shared'

const { resolve } = createResolver(import.meta.url)
const rootSecret = 'runtime-root-secret-at-least-32-characters'
const signingSecret = Buffer.from(hkdfSync('sha256', rootSecret, 'nuxt', 'nuxt-og-image:url-signing', 32)).toString('hex')

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
  nuxtConfig: {
    future: { compatibilityVersion: 5 },
    hooks: {
      'modules:before': () => {
        const nuxt = useNuxt()
        delete nuxt.options.ogImage.security.secret
      },
    },
    app: {
      baseURL: '/prefix/',
    },
    runtimeConfig: { appSecret: 'build-root-secret-at-least-32-characters' },
    ogImage: {
      security: {
        strict: true,
      },
    },
  },
  // Runtime override must win over the build-time secret.
  env: {
    NUXT_APP_SECRET: rootSecret,
  },
})

interface OgUrlResponse {
  url: string
  current: string
}

describe('getOgImageUrl in a Nitro handler', () => {
  it('builds an absolute URL signed with the runtime secret that renders', async () => {
    const { url } = await $fetch<OgUrlResponse>('/prefix/og-url')
    // fixture site.url, same origin the app side uses for og:image
    expect(url).toMatch(/^https:\/\/nuxtseo\.com\/prefix\/_og\/d\/.+,s_[\w-]+\.png$/)
    const path = new URL(url).pathname

    const [, params, signature] = path.match(/\/_og\/d\/(.+),s_([\w-]+)\.png$/)!
    expect(signature).toBe(signEncodedParams(params, signingSecret))

    const image = await fetch(path)
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toContain('image/png')
    const bytes = new Uint8Array(await image.arrayBuffer())
    // PNG magic bytes
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4E, 0x47])
  }, 60000)

  it('rejects a tampered signature', async () => {
    const { url } = await $fetch<OgUrlResponse>('/prefix/og-url')
    const tampered = new URL(url).pathname.replace(/,s_[\w-]+\.png$/, ',s_AAAAAAAAAAAAAAAA.png')
    const res = await fetch(tampered)
    expect(res.status).toBe(403)
  })

  it('signs SSR meta tags with the same derived secret without exposing it', async () => {
    const html = await $fetch<string>('/prefix/satori/ellipsis')
    const url = html.match(/property="og:image" content="([^"]+)"/)![1]!
    const [, params, signature] = new URL(url).pathname.match(/\/_og\/d\/(.+),s_([\w-]+)\.png$/)!
    expect(signature).toBe(signEncodedParams(params, signingSecret))
    expect(html).not.toContain(rootSecret)
    expect(html).not.toContain(signingSecret)
  })

  it('defaults to the request path without the baseURL', async () => {
    const { current } = await $fetch<OgUrlResponse>('/prefix/og-url?foo=bar')
    const [, params, signature] = new URL(current).pathname.match(/^\/prefix\/_og\/d\/(.+),s_([\w-]+)\.png$/)!
    expect(signature).toBe(signEncodedParams(params, signingSecret))
    expect(decodeOgImageParams(params)._path).toBe('/og-url')
  })
})
