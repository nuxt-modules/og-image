import { hkdfSync } from 'node:crypto'
import { createResolver, useNuxt } from '@nuxt/kit'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { signEncodedParams } from '../../src/runtime/shared'

const { resolve } = createResolver(import.meta.url)
const rootSecret = 'legacy-runtime-root-at-least-32-characters'
const signingSecret = Buffer.from(hkdfSync('sha256', rootSecret, 'nuxt', 'nuxt-og-image:url-signing', 32)).toString('hex')

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
  nuxtConfig: {
    hooks: {
      'modules:before': () => {
        delete useNuxt().options.ogImage.security.secret
      },
    },
    runtimeConfig: { appSecret: '' },
    ogImage: { security: { strict: true } },
  },
  env: { NUXT_APP_SECRET: '', NUXT_OG_IMAGE_SECRET: rootSecret },
})

describe('legacy signing environment fallback', () => {
  it('signs server URLs with the derived legacy root and renders the image', async () => {
    const { url } = await $fetch<{ url: string }>('/og-url')
    const path = decodeURIComponent(new URL(url).pathname)
    const [, params, signature] = path.match(/\/_og\/d\/(.+),s_([\w-]+)\.png$/)!
    expect(signature).toBe(signEncodedParams(params, signingSecret))
    const image = await fetch(path)
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toContain('image/png')
    const bytes = new Uint8Array(await image.arrayBuffer())
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4E, 0x47])
  }, 60000)

  it('rejects a tampered signature', async () => {
    const { url } = await $fetch<{ url: string }>('/og-url')
    const path = decodeURIComponent(new URL(url).pathname).replace(/,s_[\w-]+\.png$/, ',s_AAAAAAAAAAAAAAAA.png')
    expect((await fetch(path)).status).toBe(403)
  })
})
