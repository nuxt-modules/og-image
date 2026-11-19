import { createResolver, useNuxt } from '@nuxt/kit'
import { fetch, getServerLogs, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

// OG images are off: no renderer is available, as in an app that gets the module
// through @nuxtjs/seo and never enables OG images. Signing is on and no secret is set.
await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
  nuxtConfig: {
    hooks: {
      'modules:before': () => {
        delete useNuxt().options.ogImage.security.secret
      },
      'nuxt-og-image:components': (ctx) => {
        ctx.detectedRenderers.clear()
      },
    },
    runtimeConfig: { appSecret: '' },
  },
  env: { NUXT_APP_SECRET: '', NUXT_OG_IMAGE_SECRET: '' },
})

describe('signing without a renderer', () => {
  it('renders pages without reading the secret', async () => {
    const page = await fetch('/satori/ellipsis')
    expect(page.status).toBe(200)
    expect(getServerLogs().join('\n')).not.toContain('[nuxt-og-image] URL signing')
  })
})
