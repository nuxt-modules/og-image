import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clientProcessOgImageOptions } from '../../src/runtime/app/client-utils'

const mocks = vi.hoisted(() => ({
  config: { app: { baseURL: '/prefix/', cdnURL: 'https://assets.example.com/static/' }, public: {} },
  hasServerRuntime: false,
  head: {},
  useHead: vi.fn((_input: unknown) => ({ dispose: vi.fn() })),
}))

vi.mock('nuxt/app', () => ({
  injectHead: () => mocks.head,
  useHead: mocks.useHead,
  useRuntimeConfig: () => mocks.config,
}))
vi.mock('#build/nuxt-og-image/client-config.mjs', () => ({
  get hasServerRuntime() {
    return mocks.hasServerRuntime
  },
}))
vi.mock('#build/nuxt-og-image/components.mjs', () => ({ componentNames: [] }))
vi.mock('#site-config/app/composables/utils', () => ({
  createSitePathResolver: () => (path: string) => `https://example.com${path}`,
}))

const route = { query: {} } as RouteLocationNormalizedLoaded

function imageURL(): string {
  const input = mocks.useHead.mock.calls.at(-1)![0] as unknown as { meta: { property?: string, content: string }[] }
  return input.meta.find(tag => tag.property === 'og:image')!.content
}

beforeEach(() => {
  mocks.config.app.cdnURL = 'https://assets.example.com/static/'
  mocks.hasServerRuntime = false
  mocks.useHead.mockClear()
})

describe('static client image CDN URLs', () => {
  it('uses the CDN public folder without the app base prefix', () => {
    const paths = clientProcessOgImageOptions({ component: 'PageScreenshot' }, route, '/page')
    expect(imageURL()).toMatch(/^https:\/\/assets\.example\.com\/static\/_og\/s\//)
    expect(imageURL()).not.toContain('/prefix/')
    expect(paths[0]).toMatch(/^\/prefix\/_og\/s\//)
  })

  it('keeps the site origin and app base when no CDN is configured', () => {
    mocks.config.app.cdnURL = ''
    clientProcessOgImageOptions({ component: 'PageScreenshot' }, route, '/page')
    expect(imageURL()).toMatch(/^https:\/\/example\.com\/prefix\/_og\/s\//)
  })

  it('preserves page query parameters on the CDN URL', () => {
    const query = { lang: 'fr', filter: 'a & b' }
    clientProcessOgImageOptions({ component: 'PageScreenshot' }, { query } as RouteLocationNormalizedLoaded, '/page')
    expect(new URL(imageURL()).searchParams.get('_query')).toBe(JSON.stringify(query))
  })

  it('keeps runtime resolver URLs on the app origin', () => {
    mocks.hasServerRuntime = true
    clientProcessOgImageOptions({ component: 'PageScreenshot' }, route, '/page')
    expect(imageURL()).toBe('https://example.com/prefix/_og/r/page.png')
  })

  it('preserves explicit image URLs', () => {
    clientProcessOgImageOptions({ url: 'https://other.example.com/image.png' }, route, '/page')
    expect(imageURL()).toBe('https://other.example.com/image.png')
  })
})
