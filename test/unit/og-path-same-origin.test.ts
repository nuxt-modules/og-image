import type { H3Event } from '#nuxtseo/h3'
import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import { createScreenshot } from '../../src/runtime/server/og-image/browser/screenshot'
import { resolveContext } from '../../src/runtime/server/og-image/context'
import { encodeOgImageParams } from '../../src/runtime/shared/urlEncoding'

// GHSA-h5qf-97cw-2h86: `_path` decoded from an unsigned `/_og/d/` URL reached
// the browser renderer's `page.goto` unchecked, so an absolute URL navigated
// the headless browser off-origin and reflected the response into the image.

vi.mock('#nuxtseo/h3', () => ({
  createError: (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input),
}))
vi.mock('#nuxtseo/nitro', () => ({
  useNitroApp: () => ({ hooks: { callHook: async () => {} } }),
  useRuntimeConfig: () => ({}),
}))
vi.mock('#og-image-cache', () => ({ prerenderOptionsCache: undefined }))
vi.mock('#site-config/server/composables/getSiteConfig', () => ({ getSiteConfig: () => ({ url: 'https://example.com' }) }))
const nitro = vi.hoisted(() => ({ origin: 'https://example.com' }))
vi.mock('#site-config/server/composables', () => ({ getNitroOrigin: () => nitro.origin }))
vi.mock('#site-config/server/composables/utils', () => ({ createSitePathResolver: () => (p: string) => p }))
vi.mock('../../src/runtime/server/utils', () => ({
  useOgImageRuntimeConfig: () => ({ security: { secret: false }, defaults: {}, publicStoragePath: '' }),
}))
vi.mock('../../src/runtime/server/util/kit', () => ({ createNitroRouteRuleMatcher: () => () => ({}) }))
vi.mock('../../src/runtime/server/util/options', () => ({
  normaliseOptions: (options: Record<string, unknown>) => ({ options, renderer: 'browser', component: undefined }),
}))
vi.mock('../../src/runtime/server/og-image/instances', () => ({
  getBrowserRenderer: async () => ({ name: 'browser' }),
  getSatoriRenderer: async () => undefined,
  getTakumiRenderer: async () => undefined,
}))

function eventFor(_path: string): H3Event {
  const segment = encodeOgImageParams({ component: 'PageScreenshot', _path } as any)
  return { path: `/_og/d/${segment}.png`, context: {} } as unknown as H3Event
}

describe('resolveContext _path', () => {
  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'https://evil.example/x',
    'HTTP://169.254.169.254/',
    '//evil.example/x',
    '///evil.example/x',
    '/\\evil.example/x',
    '\\\\evil.example/x',
    '/\t/evil.example/x',
    '/\n/evil.example/x',
    ' //evil.example/x',
    '@evil.example/x',
    'evil.example/x',
    'javascript:alert(1)',
    'data:text/html,<h1>x</h1>',
    'file:///etc/passwd',
    'blob:https://evil.example/x',
  ])('rejects %j with 400', async (input) => {
    const ctx = await resolveContext(eventFor(input))
    expect(ctx).toMatchObject({ statusCode: 400 })
    expect((ctx as any).basePath).toBeUndefined()
  })

  it.each([
    ['/', '/'],
    ['/blog/post', '/blog/post'],
    ['/blog/post/', '/blog/post'],
    ['/@user/profile', '/@user/profile'],
    ['/search?q=http://x', '/search?q=http://x'],
    ['/caf%C3%A9', '/caf%C3%A9'],
  ])('keeps same-origin path %j as basePath %j', async (input, expected) => {
    const ctx = await resolveContext(eventFor(input))
    expect(ctx).toMatchObject({ basePath: expected })
  })

  it('defaults basePath to / when _path is absent', async () => {
    const segment = encodeOgImageParams({ component: 'PageScreenshot' } as any)
    const ctx = await resolveContext({ path: `/_og/d/${segment}.png`, context: {} } as unknown as H3Event)
    expect(ctx).toMatchObject({ basePath: '/' })
  })
})

function fakePlaywright() {
  const visited: string[] = []
  const page = {
    setViewportSize: async () => {},
    goto: async (url: string) => { visited.push(url) },
    screenshot: async () => Buffer.from('png'),
    close: async () => { closed.push(true) },
  }
  const closed: true[] = []
  const browser = { newPage: async (_opts: object) => page }
  return { browser, visited, closed }
}

describe('createScreenshot navigation', () => {
  it('navigates the PageScreenshot path on the site origin', async () => {
    const ctx = await resolveContext(eventFor('/blog/post'))
    const { browser, visited } = fakePlaywright()

    await createScreenshot(ctx as any, browser as any)

    expect(visited).toEqual(['https://example.com/blog/post'])
  })

  // With no Host header and no HOST env, site config returns `https:///`.
  it.each(['https:///', ''])('refuses to navigate when the origin is %j', async (origin) => {
    const ctx = await resolveContext(eventFor('/blog/post'))
    const { browser, visited, closed } = fakePlaywright()
    nitro.origin = origin
    try {
      await expect(createScreenshot(ctx as any, browser as any)).rejects.toThrow('same-origin path')
    }
    finally {
      nitro.origin = 'https://example.com'
    }
    expect(visited).toEqual([])
    expect(closed).toEqual([true])
  })
})
