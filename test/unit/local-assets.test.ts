import type { H3Event } from '#nuxtseo/h3'
import type { OgImageRenderEventContext, VNode } from '../../src/runtime/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { walkTree } from '../../src/runtime/server/og-image/core/plugins'
import imageSrc from '../../src/runtime/server/og-image/core/plugins/imageSrc'
import { fetchLocalAsset } from '../../src/runtime/server/util/fetchLocalAsset'

const transport = vi.hoisted(() => ({ local: vi.fn(), external: vi.fn() }))
vi.mock('#nuxtseo/nitro', () => ({
  fetchWithEvent: transport.local,
  useStorage: () => ({ hasItem: async () => false }),
}))
vi.mock('#nuxtseo/h3', () => ({ getRequestURL: () => new URL('https://site.example/render') }))
vi.mock('#site-config/server/composables', () => ({ getNitroOrigin: () => 'https://site.example' }))
vi.mock('ofetch', () => ({ $fetch: transport.external }))

const crossOriginPaths = ['//other.example/logo.png', '/\\other.example/logo.png', '/\t/other.example/logo.png', '/\n/other.example/logo.png']

function createEvent(assets?: { fetch: (url: string) => Promise<Response> }): H3Event {
  return { context: { ASSETS: assets } } as unknown as H3Event
}

function createContext(): OgImageRenderEventContext {
  return {
    e: createEvent(),
    publicStoragePath: 'public',
    runtimeConfig: { app: { baseURL: '/' }, fetchTimeout: 20 },
    timings: {
      measure: async <T>(_name: string, work: () => T | Promise<T>) => work(),
      start: () => () => {},
    },
  } as unknown as OgImageRenderEventContext
}

beforeEach(() => {
  vi.clearAllMocks()
  transport.local.mockResolvedValue(undefined)
  transport.external.mockResolvedValue(undefined)
})

describe('local asset fetch', () => {
  it.each(crossOriginPaths)('keeps %j outside local transports', async (path) => {
    const assets = { fetch: vi.fn(async () => new Response('asset')) }
    expect(await fetchLocalAsset(createEvent(assets), path, { fetchTimeout: 20, includeExternalFallback: true })).toBeUndefined()
    expect(assets.fetch).not.toHaveBeenCalled()
    expect(transport.local).not.toHaveBeenCalled()
    expect(transport.external).not.toHaveBeenCalled()
  })

  it('keeps asset query parameters when using the local transport', async () => {
    const bytes = new ArrayBuffer(4)
    transport.local.mockResolvedValue(bytes)
    const event = createEvent()
    expect(await fetchLocalAsset(event, '/logo.png?width=32', { fetchTimeout: 20 })).toBe(bytes)
    expect(transport.local).toHaveBeenCalledWith(event, '/logo.png?width=32', expect.any(Object))
  })

  it('reads a same-origin asset from the binding', async () => {
    const assets = { fetch: vi.fn(async () => new Response('asset')) }
    const bytes = await fetchLocalAsset(createEvent(assets), '/logo.png?width=32', { fetchTimeout: 20 })
    expect(new TextDecoder().decode(bytes)).toBe('asset')
    expect(assets.fetch).toHaveBeenCalledWith('https://site.example/logo.png?width=32', expect.any(Object))
    expect(transport.local).not.toHaveBeenCalled()
  })
})

describe('image asset transformation', () => {
  it.each(crossOriginPaths)('removes %j from image nodes', async (src) => {
    const node: VNode = { type: 'img', props: { src } }
    await Promise.all(walkTree(createContext(), node, [imageSrc]))
    expect(node.props.src).toBeUndefined()
    expect(transport.local).not.toHaveBeenCalled()
    expect(transport.external).not.toHaveBeenCalled()
  })

  it.each(crossOriginPaths)('removes %j from background images', async (src) => {
    const node: VNode = { type: 'div', props: { style: { backgroundImage: `url(${src})` } } }
    await Promise.all(walkTree(createContext(), node, [imageSrc]))
    expect(node.props.style?.backgroundImage).toBeUndefined()
    expect(transport.local).not.toHaveBeenCalled()
    expect(transport.external).not.toHaveBeenCalled()
  })

  it('keeps the app origin when a local image is unavailable', async () => {
    const node: VNode = { type: 'img', props: { src: '/logo.png?width=32' } }
    await Promise.all(walkTree(createContext(), node, [imageSrc]))
    expect(node.props.src).toBe('https://site.example/logo.png?width=32')
  })
})
