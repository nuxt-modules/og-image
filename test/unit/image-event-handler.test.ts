import type { H3Event } from '#nuxtseo/h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPublishedImage, getPublishKey, publishImage } from '../../src/runtime/server/og-image/cache/publish'
import { getPublishedImageCache, getPublishedImageCacheKey } from '../../src/runtime/server/og-image/cache/published'
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
  sendRedirect: (event: H3Event, url: string, status: number) => {
    event.node.res.statusCode = status
    event.node.res.setHeader('Location', url)
    return 'redirect'
  },
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
    waitUntil: vi.fn(),
    get handled() { return res.headersSent },
  } as H3Event
}

function webEvent(node?: object) {
  return { node, path: '/og.png', res: { headers: new Headers() } }
}

function setupPublishing() {
  const app = {} as Parameters<typeof getPublishedImageCache>[0]
  const storage = createStorage().mount('public', memoryDriver())
  const input = {
    storage,
    mount: 'public',
    baseURL: 'https://images.example',
    key: getPublishKey('http://localhost/_og/d/c_Test.png', {}, 'v1'),
    extension: 'png' as const,
    maxAgeSeconds: 60,
    now: Date.now,
    render: async () => new Uint8Array(image),
  }
  useStorage.mockReturnValue(storage)
  useOgImageRuntimeConfig.mockReturnValue({
    defaults: {},
    security: { renderTimeout: 15000 },
    publish: { storage: input.mount, baseURL: input.baseURL, cacheVersion: 'v1' },
  })
  const createImage = vi.fn(async () => image)
  resolveContext.mockResolvedValue({
    _nitro: app,
    timings: createTimings(),
    extension: 'png',
    renderer: { supportedFormats: ['png'], createImage },
    options: { cacheMaxAgeSeconds: 60 },
  })
  const event = nodeEvent()
  event.path = '/_og/d/c_Test.png'
  const cache = getPublishedImageCache(app)
  const cacheKey = getPublishedImageCacheKey({ storage: input.mount, baseURL: input.baseURL }, input.key, input.extension)
  return { app, storage, input, event, cache, cacheKey, createImage }
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

afterEach(async () => {
  if (vi.isFakeTimers())
    await vi.runOnlyPendingTimersAsync()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('imageEventHandler response timing', () => {
  it('redirects when the published manifest takes more than 500 ms to read', async () => {
    vi.useFakeTimers()
    const { storage, input, event } = setupPublishing()
    const published = await publishImage(input)
    if (published._tag !== 'Published')
      throw new Error('Expected publication')
    const read = storage.getItem.bind(storage)
    vi.spyOn(storage, 'getItem').mockImplementation(async (key, options) => {
      await new Promise(resolve => setTimeout(resolve, 750))
      return read(key, options)
    })

    const response = imageEventHandler(event)
    await vi.advanceTimersByTimeAsync(750)

    expect(await response).toBe('redirect')
    expect(event.node.res.getHeader('Location')).toBe(published.url)
    expect(useOgImageBufferCache).not.toHaveBeenCalled()
  })

  it('publishes in the background after a slow manifest miss', async () => {
    vi.useFakeTimers()
    const { storage, input, event } = setupPublishing()
    const read = storage.getItem.bind(storage)
    const delayedRead = vi.spyOn(storage, 'getItem').mockImplementation(async (key, options) => {
      await new Promise(resolve => setTimeout(resolve, 750))
      return read(key, options)
    })

    const response = imageEventHandler(event)
    await vi.advanceTimersByTimeAsync(750)

    expect(await response).toBe(image)
    expect(event.waitUntil).toHaveBeenCalledOnce()
    await vi.mocked(event.waitUntil).mock.calls[0]![0]
    delayedRead.mockRestore()
    expect(await getPublishedImage(input)).toMatchObject({ _tag: 'Published', url: expect.stringMatching(/^https:\/\/images\.example\//) })
  })

  it('returns image bytes without waiting for a background upload', async () => {
    vi.useFakeTimers()
    const storage = createStorage().mount('public', memoryDriver())
    vi.spyOn(storage, 'setItemRaw').mockReturnValue(new Promise(() => {}))
    useStorage.mockReturnValue(storage)
    useOgImageRuntimeConfig.mockReturnValue({
      defaults: {},
      security: { renderTimeout: 100 },
      publish: { storage: 'public', baseURL: 'https://images.example', cacheVersion: 'v1' },
    })
    resolveContext.mockResolvedValue({
      _nitro: {},
      timings: createTimings(),
      extension: 'png',
      renderer: { supportedFormats: ['png'] },
      options: { cacheMaxAgeSeconds: 60 },
    })
    const event = nodeEvent()
    event.path = '/_og/d/c_Test.png'
    const completed = vi.fn()
    const response = imageEventHandler(event).then(completed)
    await vi.advanceTimersByTimeAsync(0)
    expect(completed).toHaveBeenCalledWith(image)
    await response
    expect(event.waitUntil).toHaveBeenCalledOnce()
    const next = nodeEvent()
    next.path = event.path
    expect(await imageEventHandler(next)).toBe(image)
    expect(next.waitUntil).not.toHaveBeenCalled()
  })

  it('warms the local URL cache only after the background upload completes', async () => {
    const { storage, input, event, cache, cacheKey } = setupPublishing()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const write = storage.setItemRaw.bind(storage)
    vi.spyOn(storage, 'setItemRaw').mockImplementation(async (key, value, options) => {
      await gate
      await write(key, value, options)
    })
    const expiresAt = Date.now() + 5000
    useOgImageBufferCache.mockResolvedValue({ cachedItem: image, expiresAt })
    expect(await imageEventHandler(event)).toBe(image)
    expect(cache.get(cacheKey, Date.now())).toBeUndefined()
    release()
    await vi.mocked(event.waitUntil).mock.calls[0]![0]
    const published = await getPublishedImage(input)
    expect(cache.get(cacheKey, Date.now())).toEqual(published)
    expect(cache.get(cacheKey, Date.now())?.expiresAt).toBe(expiresAt)
  })

  it('redirects a published image without rendering or extending its redirect TTL', async () => {
    vi.useFakeTimers({ now: 1000 })
    const { input, event } = setupPublishing()
    const published = await publishImage(input)
    if (published._tag !== 'Published')
      throw new Error('Expected publication')
    await vi.advanceTimersByTimeAsync(1500)
    expect(await imageEventHandler(event)).toBe('redirect')
    expect(event.node.res.statusCode).toBe(302)
    expect(event.node.res.getHeader('Location')).toBe(published.url)
    expect(event.node.res.getHeader('Cache-Control')).toBe('public, max-age=58, s-maxage=58')
    expect(useOgImageBufferCache).not.toHaveBeenCalled()
    expect(event.waitUntil).not.toHaveBeenCalled()
  })

  it('bypasses the published object on purge and publishes the fresh bytes', async () => {
    const { input, event, createImage } = setupPublishing()
    const old = await publishImage(input)
    const fresh = Buffer.from('fresh image')
    createImage.mockResolvedValue(fresh)
    useOgImageBufferCache.mockResolvedValue({ cachedItem: false, update: vi.fn(), expiresAt: Date.now() + 60000 })
    event.path += '?purge=true'
    expect(await imageEventHandler(event)).toBe(fresh)
    expect(event.node.res.statusCode).toBe(200)
    await vi.mocked(event.waitUntil).mock.calls[0]![0]
    expect(await getPublishedImage(input)).not.toEqual(old)
  })

  it('preserves the known URL and manifest when purge authentication fails', async () => {
    const { input, event, cache, cacheKey } = setupPublishing()
    const published = await publishImage(input)
    await imageEventHandler(event)
    const denied = Object.assign(new Error('Invalid purge token'), { statusCode: 403 })
    useOgImageBufferCache.mockResolvedValue(denied)
    event.path += '?purge=wrong'
    expect(await imageEventHandler(event)).toBe(denied)
    expect(cache.get(cacheKey, Date.now())).toEqual(published)
    expect(await getPublishedImage(input)).toEqual(published)
    expect(event.waitUntil).not.toHaveBeenCalled()
  })

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
