import type { H3Event } from '#nuxtseo/h3'
import { createFetch } from 'ofetch'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchLocalAsset } from '../../src/runtime/server/util/fetchLocalAsset'

const transport = vi.hoisted(() => ({ external: vi.fn() }))
vi.mock('#nuxtseo/nitro', () => ({
  fetchWithEvent: (event: { $fetch: (path: string, options: unknown) => unknown }, path: string, options: unknown) => event.$fetch(path, options),
}))
vi.mock('#nuxtseo/h3', () => ({ getRequestURL: () => new URL('https://site.example/render') }))
vi.mock('#site-config/server/composables', () => ({ getNitroOrigin: () => 'https://site.example' }))
vi.mock('#og-image/bindings/fetch', () => ({ guardedFetch: transport.external }))

beforeEach(() => {
  vi.clearAllMocks()
  transport.external.mockResolvedValue(new Response('asset bytes'))
})

describe('local asset response', () => {
  it.each([301, 302, 303, 307, 308, 404, 500])('uses the validated fallback after status %i', async (status) => {
    const local = createFetch({ fetch: async () => new Response('response body', { status, headers: { location: '/actual.png' } }) })
    const event = { context: {}, $fetch: local } as unknown as H3Event
    const bytes = await fetchLocalAsset(event, '/logo.png', { fetchTimeout: 100, includeExternalFallback: true })
    expect(new TextDecoder().decode(bytes)).toBe('asset bytes')
    expect(transport.external).toHaveBeenCalledOnce()
  })

  it('uses a successful local response without an external fetch', async () => {
    const local = createFetch({ fetch: async () => new Response('local bytes') })
    const event = { context: {}, $fetch: local } as unknown as H3Event
    const bytes = await fetchLocalAsset(event, '/logo.png', { fetchTimeout: 100, includeExternalFallback: true })
    expect(new TextDecoder().decode(bytes)).toBe('local bytes')
    expect(transport.external).not.toHaveBeenCalled()
  })
})
