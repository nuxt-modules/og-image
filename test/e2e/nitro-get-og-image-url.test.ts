import { createResolver } from '@nuxt/kit'
import { $fetch, fetch, setup, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

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
        secret: 'e2e-nitro-secret',
      },
    },
  },
})

interface OgUrlResponse {
  relative: string
  absolute: string
  path: string
}

describe('getOgImageUrl in a Nitro handler', () => {
  it('builds a signed URL that renders', async () => {
    const res = await $fetch<OgUrlResponse>('/prefix/og-url')

    expect(res.relative).toMatch(/^\/prefix\/_og\/d\/.+,s_[\w-]+\.png$/)
    expect(res.path).toBe(res.relative)
    expect(res.absolute).toBe(new URL(res.relative, url('/')).href)

    const image = await fetch(res.relative)
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toContain('image/png')
    const bytes = new Uint8Array(await image.arrayBuffer())
    // PNG magic bytes
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4E, 0x47])
  }, 60000)

  it('rejects a tampered signature', async () => {
    const { relative } = await $fetch<OgUrlResponse>('/prefix/og-url')
    const tampered = relative.replace(/,s_[\w-]+\.png$/, ',s_AAAAAAAAAAAAAAAA.png')
    const res = await fetch(tampered)
    expect(res.status).toBe(403)
  })

  it('uses x-forwarded-host for the absolute origin', async () => {
    const res = await $fetch<OgUrlResponse>('/prefix/og-url', {
      headers: { 'x-forwarded-host': 'og.example.com' },
    })
    expect(new URL(res.absolute).host).toBe('og.example.com')
    expect(new URL(res.absolute).pathname).toBe(res.relative)
  })
})
