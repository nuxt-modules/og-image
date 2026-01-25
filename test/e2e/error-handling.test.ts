import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
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
  },
})

describe('error handling', () => {
  it('defaults to png for missing extension', async () => {
    // Should not throw "Missing OG Image type"

    // Using a simple path that might render or at least pass validation

    const res = await $fetch('/prefix/_og/d/title_hello', {

      responseType: 'blob',

    })

    expect(res).toBeTruthy()

    expect(res.type).toBe('image/png')
  })

  it('handles dots in params without extension', async () => {
    const res = await $fetch('/prefix/_og/d/title_hello.world,theme_dark', {
      responseType: 'blob',
    })
    expect(res).toBeTruthy()
    expect(res.type).toBe('image/png')
  })

  it('defaults to png for invalid extension', async () => {
    const res = await $fetch('/prefix/_og/d/title_hello.xyz', {
      responseType: 'blob',
    })
    expect(res).toBeTruthy()
    expect(res.type).toBe('image/png')
  })
})
