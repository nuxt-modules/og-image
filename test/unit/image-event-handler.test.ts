import type { H3Event } from '#nuxtseo/h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createStorage } from 'unstorage'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { imageEventHandler } from '../../src/runtime/server/util/eventHandlers'
import { createTimings } from '../../src/runtime/server/util/timings'

const { resolveContext, useOgImageBufferCache, useStorage, useOgImageRuntimeConfig, warn } = vi.hoisted(() => ({
  resolveContext: vi.fn(),
  useOgImageBufferCache: vi.fn(),
  useStorage: vi.fn(),
  useOgImageRuntimeConfig: vi.fn(),
  warn: vi.fn(),
}))

// Model both adapter header APIs while retaining Node's real sent-header errors.
vi.mock('#nuxtseo/h3', () => ({
  appendResponseHeader: (event: H3Event, name: string, value: string) => {
    if (event.node?.res) {
      const current = event.node.res.getHeader(name)
      event.node.res.setHeader(name, current ? [...(Array.isArray(current) ? current : [current.toString()]), value] : value)
    }
    else {
      (event as unknown as { res: { headers: Headers } }).res.headers.append(name, value)
    }
  },
  H3Error: Error,
  createError: (input: object) => Object.assign(new Error('HTTP error'), input),
  getRequestHost: () => 'localhost',
  setHeader: (event: H3Event, name: string, value: string) => {
    if (event.node?.res)
      event.node.res.setHeader(name, value)
    else
      (event as unknown as { res: { headers: Headers } }).res.headers.set(name, value)
  },
}))
vi.mock('#site-config/server/composables/getSiteConfig', () => ({ getSiteConfig: () => ({ url: 'http://localhost' }) }))
vi.mock('#nuxtseo/nitro', () => ({ useStorage }))
vi.mock('../../src/runtime/server/og-image/context', () => ({ resolveContext }))
vi.mock('../../src/runtime/server/util/cache', () => ({ useOgImageBufferCache }))
vi.mock('../../src/runtime/server/utils', () => ({ useOgImageRuntimeConfig }))
vi.mock('../../src/runtime/logger', () => ({ logger: { warn, debug: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/runtime/server/og-image/cache/buildCache', () => ({ getBuildCachedImage: vi.fn(), setBuildCachedImage: vi.fn() }))
vi.mock('../../src/runtime/server/og-image/devtools', () => ({ fetchPathHtmlAndExtractOptions: vi.fn() }))
vi.mock('../../src/runtime/server/og-image/templates/html', () => ({ html: vi.fn() }))

const image = Buffer.from('cached image')

function nodeEvent() {
  const req = new IncomingMessage(new Socket())
  const res = new ServerResponse(req)
  return {
    node: { req, res },
    path: '/og.png',
    get handled() { return res.headersSent },
  } as H3Event
}

function webEvent(node?: object) {
  return { node, path: '/og.png', res: { headers: new Headers() } }
}

beforeEach(() => {
  vi.resetAllMocks()
  useOgImageRuntimeConfig.mockReturnValue({})
  resolveContext.mockResolvedValue({
    timings: createTimings(),
    extension: 'png',
    renderer: { supportedFormats: ['png'] },
    options: {},
  })
  useOgImageBufferCache.mockResolvedValue({ cachedItem: image })
})

describe('imageEventHandler response timing', () => {
  it('warns once per app when publishing fails and still serves each image', async () => {
    const app = {}
    useStorage.mockReturnValue(createStorage())
    useOgImageRuntimeConfig.mockReturnValue({
      defaults: {},
      security: { renderTimeout: 100 },
      publish: { storage: 'missing', baseURL: 'https://files.example.com', cacheVersion: 'v1' },
    })
    resolveContext.mockImplementation(async () => ({
      _nitro: app,
      timings: createTimings(),
      extension: 'png',
      renderer: { supportedFormats: ['png'] },
      options: { cacheMaxAgeSeconds: 60 },
    }))
    for (let request = 0; request < 2; request++) {
      const event = nodeEvent()
      event.path = '/_og/d/c_Test.png'
      expect(await imageEventHandler(event)).toBe(image)
    }
    expect(warn).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Publish storage is unavailable'), expect.stringContaining('mounted driver'))
  })

  it('adds timing to an unsent Node response and returns the image', async () => {
    const event = nodeEvent()

    expect(await imageEventHandler(event)).toBe(image)
    expect(event.node.res.getHeader('Server-Timing')).toContain('total;dur=')
  })

  it.each([
    { existing: 'app;dur=12' },
    { existing: ['app;dur=12', 'db;dur=4'] },
  ])('preserves existing Node timing $existing', async ({ existing }) => {
    const event = nodeEvent()
    event.node.res.setHeader('Server-Timing', existing)

    expect(await imageEventHandler(event)).toBe(image)
    const timing = event.node.res.getHeader('Server-Timing')
    const value = Array.isArray(timing) ? timing.join(', ') : String(timing)
    for (const metric of [existing].flat())
      expect(value).toContain(metric)
    expect(value).toContain('total;dur=')
  })

  it('preserves existing web timing', async () => {
    const event = webEvent()
    event.res.headers.set('Server-Timing', 'app;dur=12, db;dur=4')

    expect(await imageEventHandler(event as unknown as H3Event)).toBe(image)
    const timing = event.res.headers.get('Server-Timing')
    expect(timing).toContain('app;dur=12, db;dur=4')
    expect(timing).toContain('total;dur=')
  })

  it('preserves a committed 304 response', async () => {
    const event = nodeEvent()
    useOgImageBufferCache.mockImplementation(async () => {
      event.node.res.writeHead(304)
      event.node.res.end()
    })

    expect(await imageEventHandler(event)).toBeUndefined()
    expect(event.node.res.statusCode).toBe(304)
    expect(event.node.res.getHeader('Server-Timing')).toBeUndefined()
  })

  it('preserves the original error after Node headers are sent', async () => {
    const event = nodeEvent()
    const error = new Error('cache failed')
    useOgImageBufferCache.mockImplementation(async () => {
      event.node.res.writeHead(200)
      throw error
    })

    await expect(imageEventHandler(event)).rejects.toBe(error)
    expect(event.node.res.getHeader('Server-Timing')).toBeUndefined()
  })

  it.each([undefined, {}])('adds timing to a web response with node=%j', async (node) => {
    const event = webEvent(node)

    expect(await imageEventHandler(event as unknown as H3Event)).toBe(image)
    expect(event.res.headers.get('Server-Timing')).toContain('total;dur=')
  })

  it('preserves the original error and timing on a web response', async () => {
    const event = webEvent()
    const error = new Error('cache failed')
    useOgImageBufferCache.mockRejectedValue(error)

    await expect(imageEventHandler(event as unknown as H3Event)).rejects.toBe(error)
    expect(event.res.headers.get('Server-Timing')).toContain('total;dur=')
  })
})
