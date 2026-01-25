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
  it('returns explicit error for missing extension', async () => {
    try {
      // Using a path that should trigger the OG image handler but missing extension
      // The handler is typically at /_og/...
      // We use a dummy path that looks like encoded params
      await $fetch('/prefix/_og/d/title_hello')
    }
    catch (e: any) {
      expect(e.response.status).toBe(400)
      expect(e.response.statusText).toContain('Missing OG Image type')
    }
  })

  it('returns explicit error for invalid extension', async () => {
    try {
      await $fetch('/prefix/_og/d/title_hello.xyz')
    }
    catch (e: any) {
      expect(e.response.status).toBe(400)
      expect(e.response.statusText).toContain('Unknown OG Image type "xyz"')
    }
  })

  it('returns explicit error for extension that contains slash', async () => {
    try {
      await $fetch('/prefix/_og/d/title_hello/v1')
    }
    catch (e: any) {
      expect(e.response.status).toBe(400)
      expect(e.response.statusText).toContain('Missing OG Image type')
    }
  })
})
