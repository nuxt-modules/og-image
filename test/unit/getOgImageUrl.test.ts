import { describe, expect, it, vi } from 'vitest'
import { getOgImageUrl } from '../../src/runtime/server/nitro'

const boundary = vi.hoisted(() => ({
  getOgImagePath: vi.fn((_event: unknown, pagePath: string, _options: unknown) => ({ path: `/docs/image${pagePath}.png` })),
}))
vi.mock('nuxt/server', () => ({
  getRequestURL: (event: { url: URL }) => event.url,
  useRuntimeConfig: () => ({ app: { baseURL: '/docs/' } }),
}))
vi.mock('../../src/runtime/server/utils', () => boundary)
vi.mock('#site-config/server/composables/utils', async () => {
  const { resolveSitePath } = await import('nuxt-site-config/urls')
  return {
    withSiteUrl: (_event: unknown, path: string, options: { withBase?: boolean }) => resolveSitePath(path, {
      siteUrl: 'https://example.com',
      base: '/docs/',
      absolute: true,
      withBase: options.withBase,
    }),
  }
})

function request(path: string) {
  return { url: new URL(path, 'https://request.example.com'), req: new Request(new URL(path, 'https://request.example.com')), context: {} }
}

describe('getOgImageUrl portable request', () => {
  it('uses the current pathname without its base or query', () => {
    const event = request('/docs/articles?sort=latest')
    const options = { component: 'Article.satori' }
    expect(getOgImageUrl(event, options)).toBe('https://example.com/docs/image/articles.png')
    expect(boundary.getOgImagePath).toHaveBeenLastCalledWith(event, '/articles', options)
  })

  it('keeps an explicit page path and image options', () => {
    const event = request('/docs/current?sort=latest')
    const options = { props: { title: 'Explicit' } }
    expect(getOgImageUrl(event, '/explicit', options)).toBe('https://example.com/docs/image/explicit.png')
    expect(boundary.getOgImagePath).toHaveBeenLastCalledWith(event, '/explicit', options)
  })

  it('uses the root path when the request contains only the base', () => {
    expect(getOgImageUrl(request('/docs/?query=ignored'))).toBe('https://example.com/docs/image/.png')
  })
})
