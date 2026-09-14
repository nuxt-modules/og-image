import type { H3Event } from '#nuxtseo/h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { imageEventHandler } from '../../src/runtime/server/util/eventHandlers'
import { createTimings } from '../../src/runtime/server/util/timings'

const { resolveContext, useOgImageBufferCache } = vi.hoisted(() => ({
  resolveContext: vi.fn(),
  useOgImageBufferCache: vi.fn(),
}))

// Model both adapter header APIs while retaining Node's real sent-header errors.
vi.mock('#nuxtseo/h3', () => ({
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
vi.mock('../../src/runtime/server/og-image/context', () => ({ resolveContext }))
vi.mock('../../src/runtime/server/util/cache', () => ({ useOgImageBufferCache }))
vi.mock('../../src/runtime/server/utils', () => ({ useOgImageRuntimeConfig: () => ({}) }))
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
  resolveContext.mockResolvedValue({
    timings: createTimings(),
    extension: 'png',
    renderer: { supportedFormats: ['png'] },
    options: {},
  })
  useOgImageBufferCache.mockResolvedValue({ cachedItem: image })
})

describe('imageEventHandler response timing', () => {
  it('adds timing to an unsent Node response and returns the image', async () => {
    const event = nodeEvent()

    expect(await imageEventHandler(event)).toBe(image)
    expect(event.node.res.getHeader('Server-Timing')).toContain('total;dur=')
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
