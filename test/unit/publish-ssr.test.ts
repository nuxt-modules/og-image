import { createHooks } from 'hookable'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPublishKey, publishImage } from '../../src/runtime/server/og-image/cache/publish'
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
  await publishPlugin({ hooks } as Parameters<typeof publishPlugin>[0])
  const html = { head: [`<meta property="og:image" content="${imageURL}">`, `<meta name="twitter:image" content="${imageURL}">`] }
  const render = () => hooks.callHook('render:html', html, { event: { path: '/article' } })
  return { storage, html, render }
}

describe('published SSR image URLs', () => {
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

  it('keeps app URLs when storage hangs, without waiting for the render timeout', async () => {
    vi.useFakeTimers()
    const { storage, html, render } = await setup()
    vi.spyOn(storage, 'getItem').mockReturnValue(new Promise(() => {}))
    const completed = vi.fn()
    const rendering = render().then(completed)
    await vi.advanceTimersByTimeAsync(500)
    expect(completed).toHaveBeenCalledOnce()
    await rendering
    expect(html.head).toEqual([`<meta property="og:image" content="${imageURL}">`, `<meta name="twitter:image" content="${imageURL}">`])
    expect(warn).toHaveBeenCalledOnce()
  })

  it('uses a fresh published URL and looks up duplicate image tags once', async () => {
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
    expect(html.head).toEqual([`<meta property="og:image" content="${published.url}">`, `<meta name="twitter:image" content="${published.url}">`])
    expect(lookup).toHaveBeenCalledOnce()
    expect(warn).not.toHaveBeenCalled()
  })
})
