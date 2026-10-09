import { createHooks } from 'hookable'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPublishKey, publishImage } from '../../src/runtime/server/og-image/cache/publish'
import { getPublishedImageCache, getPublishedImageCacheKey } from '../../src/runtime/server/og-image/cache/published'
import publishPlugin from '../../src/runtime/server/plugins/publish'

const { useStorage, useOgImageRuntimeConfig, warn } = vi.hoisted(() => ({
  useStorage: vi.fn(),
  useOgImageRuntimeConfig: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('#nuxtseo/nitro', () => ({ defineNitroPlugin: (plugin: unknown) => plugin, useStorage }))
vi.mock('#site-config/server/composables/getSiteConfig', () => ({ getSiteConfig: () => ({ url: 'https://site.example' }) }))
vi.mock('../../src/runtime/server/utils', () => ({ useOgImageRuntimeConfig }))
vi.mock('../../src/runtime/logger', () => ({ logger: { warn, debug: vi.fn() } }))

const imageURL = 'https://site.example/_og/d/c_Test.png'
const config = {
  app: { baseURL: '/' },
  defaults: { cacheMaxAgeSeconds: 60 },
  security: { renderTimeout: 15000 },
  publish: { storage: 'public', baseURL: 'https://images.example', cacheVersion: 'v1' },
}

beforeEach(() => {
  vi.resetAllMocks()
  useOgImageRuntimeConfig.mockReturnValue(config)
})

afterEach(async () => {
  if (vi.isFakeTimers())
    await vi.runOnlyPendingTimersAsync()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function setup() {
  const storage = createStorage()
  storage.mount('public', memoryDriver())
  useStorage.mockReturnValue(storage)
  const hooks = createHooks()
  const app = { hooks } as Parameters<typeof publishPlugin>[0]
  await publishPlugin(app)
  const html = { head: [`<meta property="og:image" content="${imageURL}">`, `<meta name="twitter:image" content="${imageURL}">`] }
  const render = () => hooks.callHook('render:html', html, { event: { path: '/article' } })
  return { storage, html, render, app }
}

describe('published SSR image URLs', () => {
  it('escapes public URLs in HTML attributes', async () => {
    const { html, render, app } = await setup()
    const key = getPublishedImageCacheKey(config.publish, getPublishKey(imageURL, config.defaults, 'v1'), 'png')
    getPublishedImageCache(app).remember(key, { _tag: 'Published', url: 'https://images.example/a&b/image.png', objectKey: 'image.png', expiresAt: Date.now() + 60000 }, Date.now())
    await render()
    expect(html.head[0]).toContain('content="https://images.example/a&amp;b/image.png"')
  })
  it.each([
    [],
    ['<meta property="og:image" content="https://site.example/_og/s/static.png">'],
    ['<meta property="og:image" content="https://images.example/published.png">'],
  ])('does no storage lookup without an app runtime image: %j', async (...head) => {
    const { storage, html, render } = await setup()
    html.head = head
    const lookup = vi.spyOn(storage, 'getItem')
    await render()
    expect(lookup).not.toHaveBeenCalled()
    expect(html.head).toEqual(head)
  })

  it('does no storage lookup when publishing is disabled', async () => {
    const { storage, html, render } = await setup()
    useOgImageRuntimeConfig.mockReturnValue({ ...config, publish: undefined })
    const lookup = vi.spyOn(storage, 'getItem')
    await render()
    expect(lookup).not.toHaveBeenCalled()
    expect(html.head[0]).toContain(imageURL)
  })

  it('keeps app URLs immediately without contacting storage', async () => {
    vi.useFakeTimers()
    const { storage, html, render } = await setup()
    const lookup = vi.spyOn(storage, 'getItem').mockReturnValue(new Promise(() => {}))
    const completed = vi.fn()
    const rendering = Promise.resolve(render()).then(completed)
    await vi.advanceTimersByTimeAsync(0)
    expect(completed).toHaveBeenCalledOnce()
    await rendering
    expect(html.head).toEqual([`<meta property="og:image" content="${imageURL}">`, `<meta name="twitter:image" content="${imageURL}">`])
    expect(lookup).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it('keeps the app URL on a cold Worker even when storage contains a published image', async () => {
    const { storage, html, render } = await setup()
    const published = await publishImage({
      storage,
      mount: 'public',
      baseURL: config.publish.baseURL,
      key: getPublishKey(imageURL, config.defaults, 'v1'),
      extension: 'png',
      maxAgeSeconds: 60,
      now: Date.now,
      render: async () => new Uint8Array([1, 2, 3]),
    })
    if (published._tag !== 'Published')
      throw new Error('Expected a published image')
    const lookup = vi.spyOn(storage, 'getItem')
    await render()
    expect(html.head).toEqual([`<meta property="og:image" content="${imageURL}">`, `<meta name="twitter:image" content="${imageURL}">`])
    expect(lookup).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it('uses a locally known public URL without storage, then returns to the app URL at expiry', async () => {
    vi.useFakeTimers({ now: 1000 })
    const { storage, html, render, app } = await setup()
    const key = getPublishedImageCacheKey(config.publish, getPublishKey(imageURL, config.defaults, 'v1'), 'png')
    getPublishedImageCache(app).remember(key, { _tag: 'Published', url: 'https://images.example/image.png', objectKey: 'image.png', expiresAt: 2000 }, 1000)
    const lookup = vi.spyOn(storage, 'getItem')
    await render()
    expect(html.head).toEqual(['<meta property="og:image" content="https://images.example/image.png">', '<meta name="twitter:image" content="https://images.example/image.png">'])
    expect(lookup).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    html.head = [`<meta property="og:image" content="${imageURL}">`]
    await render()
    expect(html.head).toEqual([`<meta property="og:image" content="${imageURL}">`])
    expect(lookup).not.toHaveBeenCalled()
  })
})
