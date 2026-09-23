import { createResolver } from '@nuxt/kit'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { signEncodedParams } from '../../src/runtime/shared'

const { resolve } = createResolver(import.meta.url)

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
        strict: true,
        secret: 'build-secret',
      },
    },
  },
  // Runtime override must win over the build-time secret.
  env: {
    NUXT_OG_IMAGE_SECRET: 'runtime-secret',
  },
})

interface OgUrlResponse {
  url: string
  path: string
}

describe('getOgImageUrl in a Nitro handler', () => {
  it('builds an absolute URL signed with the runtime secret that renders', async () => {
    const res = await $fetch<OgUrlResponse>('/prefix/og-url')

    expect(res.path).toMatch(/^\/prefix\/_og\/d\/.+,s_[\w-]+\.png$/)
    // fixture site.url, same origin the app side uses for og:image
    expect(res.url).toBe(`https://nuxtseo.com${res.path}`)

    const [, params, signature] = res.path.match(/\/_og\/d\/(.+),s_([\w-]+)\.png$/)!
    expect(signature).toBe(signEncodedParams(params, 'runtime-secret'))

    const image = await fetch(res.path)
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toContain('image/png')
    const bytes = new Uint8Array(await image.arrayBuffer())
    // PNG magic bytes
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4E, 0x47])
  }, 60000)

  it('rejects a tampered signature', async () => {
    const { path } = await $fetch<OgUrlResponse>('/prefix/og-url')
    const tampered = path.replace(/,s_[\w-]+\.png$/, ',s_AAAAAAAAAAAAAAAA.png')
    const res = await fetch(tampered)
    expect(res.status).toBe(403)
  })
})
