import { createResolver, useNuxt } from '@nuxt/kit'
import { $fetch, fetch, getServerLogs, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

// Signing is on and no root secret reaches the production server.
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
  },
  env: { NUXT_APP_SECRET: '', NUXT_OG_IMAGE_SECRET: '' },
})

function ogImagePath(html: string): string {
  const content = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)?.[1]
  expect(content).toBeDefined()
  return new URL(content!.replaceAll('&amp;', '&')).pathname
}

describe('missing signing secret', () => {
  it('renders server-rendered pages', async () => {
    const page = await fetch('/satori/ellipsis')
    expect(page.status).toBe(200)
    expect(ogImagePath(await page.text())).toMatch(/^\/_og\/d\//)
  })

  it('logs the fix', async () => {
    await fetch('/satori/ellipsis')
    expect(getServerLogs().join('\n')).toContain('Run `npx nuxt-og-image generate-secret`, then set NUXT_APP_SECRET')
  })

  it('refuses to render the page image', async () => {
    const path = ogImagePath(await $fetch<string>('/satori/ellipsis'))
    const image = await fetch(path)
    expect(image.status).toBe(500)
    expect(image.headers.get('content-type')).not.toContain('image/')
  })

  it('refuses unsigned image requests', async () => {
    const image = await fetch('/_og/d/c_NuxtSeo.satori,title_Forged.png')
    expect(image.status).toBe(500)
  })

  it('refuses cache purges', async () => {
    const image = await fetch('/_og/d/c_NuxtSeo.satori,title_Forged.png?purge=1')
    expect(image.status).toBe(500)
  })
})
