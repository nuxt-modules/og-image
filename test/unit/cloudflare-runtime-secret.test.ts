import { describe, expect, it, vi } from 'vitest'

const runtimeConfig = {
  'app': {
    baseURL: '/',
  },
  'nuxt-og-image': {
    defaults: {},
    security: {
      strict: true,
      secret: '',
    },
  },
  'ogImage': {
    secret: '',
  },
}

vi.mock('nitropack/runtime', () => ({
  useRuntimeConfig: () => runtimeConfig,
}))

vi.mock('#og-image-virtual/component-names.mjs', () => ({
  componentNames: [],
}))

describe('cloudflare runtime secret', () => {
  it('reads NUXT_OG_IMAGE_SECRET from Cloudflare env bindings', async () => {
    const { useOgImageRuntimeConfig } = await import('../../src/runtime/server/utils')

    const config = useOgImageRuntimeConfig({
      context: {
        cloudflare: {
          env: {
            NUXT_OG_IMAGE_SECRET: 'cf-secret',
          },
        },
      },
    } as any)

    expect(config.security.secret).toBe('cf-secret')
  })
})
