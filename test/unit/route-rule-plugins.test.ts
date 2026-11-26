import type { RouteRuleRuntimeConfig } from '../../src/runtime/shared/routeRules'
import { createHead as createServerHead, renderSSRHead } from '@unhead/vue/server'
import { createHooks } from 'hookable'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getEventStatusCode, isErrorResponseEvent } from '../../src/runtime/shared'
import { createCachedRouteRuleMatcher } from '../../src/runtime/shared/routeRules'

const { createNitroRouteRuleMatcher: realCreateNitroRouteRuleMatcher } = await vi.importActual<typeof import('nuxtseo-shared/server')>('nuxtseo-shared/server')

const mocks = vi.hoisted(() => ({
  createNitroRouteRuleMatcher: vi.fn(),
  createOgImageMeta: vi.fn(),
  getOgImagePath: vi.fn((url: string) => ({ path: `/_og/d/path_${encodeURIComponent(url)}.png`, hash: undefined })),
  requestEvent: undefined as any,
}))

vi.mock('nuxtseo-shared/server', () => ({
  createNitroRouteRuleMatcher: (runtimeConfig: RouteRuleRuntimeConfig) => mocks.createNitroRouteRuleMatcher(runtimeConfig),
}))

vi.mock('#app', () => ({
  defineNuxtPlugin: (plugin: unknown) => plugin,
  useRequestEvent: () => mocks.requestEvent,
}))

vi.mock('#site-config/app', () => ({
  withSiteUrl: (path: string) => `https://example.com${path.startsWith('/') ? path : `/${path}`}`,
}))

vi.mock('../../src/runtime/app/utils', () => ({
  createOgImageMeta: mocks.createOgImageMeta,
  getOgImagePath: mocks.getOgImagePath,
}))

const { ogImageCanonicalUrls, routeRuleOgImage } = await import('../../src/runtime/app/utils/plugins')

function buildRouteRules(count: number, extra: Record<string, any> = {}): Record<string, any> {
  const rules: Record<string, any> = {}
  for (let i = 0; i < count; i++)
    rules[`/redirect-${i}`] = { redirect: `/target-${i}` }
  return { ...rules, ...extra }
}

function createMockNuxtApp(options: {
  path?: string
  runtimeConfig?: RouteRuleRuntimeConfig
  ssrError?: boolean
  payloadError?: Record<string, any>
  nuxtPayloadError?: Record<string, any>
  event?: Record<string, any>
} = {}) {
  const hooks = createHooks()
  const head = createServerHead()
  const event = {
    path: options.path ?? '/blog/hello',
    context: {} as Record<string, any>,
    ...options.event,
  }
  mocks.requestEvent = event
  const ssrContext: Record<string, any> = {
    url: event.path,
    event,
    head,
    error: options.ssrError ?? false,
    payload: options.payloadError ? { error: options.payloadError } : {},
    runtimeConfig: options.runtimeConfig ?? { app: { baseURL: '/' }, nitro: { routeRules: {} } },
  }
  const nuxtApp: Record<string, any> = {
    hooks,
    ssrContext,
    payload: options.nuxtPayloadError ? { error: options.nuxtPayloadError } : ssrContext.payload,
    runWithContext: (fn: () => unknown) => fn(),
  }
  return { nuxtApp, ssrContext, head, event, hooks }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createNitroRouteRuleMatcher.mockImplementation((runtimeConfig: RouteRuleRuntimeConfig) => realCreateNitroRouteRuleMatcher(runtimeConfig))
  mocks.requestEvent = undefined
})

describe('createCachedRouteRuleMatcher', () => {
  it('skips radix3 compilation when routeRules have no ogImage entries', () => {
    const spy = vi.fn((cfg: RouteRuleRuntimeConfig) => realCreateNitroRouteRuleMatcher(cfg))
    const getMatcher = createCachedRouteRuleMatcher(spy)
    const config: RouteRuleRuntimeConfig = {
      app: { baseURL: '/' },
      nitro: { routeRules: buildRouteRules(120) },
    }

    expect(getMatcher(config)('/redirect-1')).toEqual({})
    expect(getMatcher(structuredClone(config))('/redirect-2')).toEqual({})
    expect(spy).not.toHaveBeenCalled()
  })

  it('compiles radix3 once across Nitro 3 shared refs and Nitro 2 cloned configs', () => {
    const spy = vi.fn((cfg: RouteRuleRuntimeConfig) => realCreateNitroRouteRuleMatcher(cfg))
    const getMatcher = createCachedRouteRuleMatcher(spy)
    const baseConfig: RouteRuleRuntimeConfig = {
      app: { baseURL: '/' },
      nitro: {
        routeRules: buildRouteRules(120, {
          '/blog/**': { ogImage: { component: 'BlogPost' } },
          '/blog/private': { ogImage: false },
        }),
      },
    }

    // Same reference (Nitro 3)
    const m1 = getMatcher(baseConfig)
    const m2 = getMatcher(baseConfig)
    // Cloned per request (Nitro 2 klona)
    const m3 = getMatcher(structuredClone(baseConfig))
    const m4 = getMatcher(structuredClone(baseConfig))

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![0].nitro?.routeRules).toEqual({
      '/blog/**': { ogImage: { component: 'BlogPost' } },
      '/blog/private': { ogImage: false },
    })
    expect(m2).toBe(m1)
    expect(m3).toBe(m1)
    expect(m4).toBe(m1)
    expect(m3('/blog/post').ogImage).toEqual({ component: 'BlogPost' })
    expect(m4('/blog/private').ogImage).toBe(false)
    expect(m4('/about').ogImage).toBeUndefined()
  })

  it('rebuilds when ogImage rules or baseURL change without leaking across configs', () => {
    const spy = vi.fn((cfg: RouteRuleRuntimeConfig) => realCreateNitroRouteRuleMatcher(cfg))
    const getMatcher = createCachedRouteRuleMatcher(spy)

    const configA: RouteRuleRuntimeConfig = {
      app: { baseURL: '/' },
      nitro: { routeRules: { '/docs/**': { ogImage: { title: 'A' } } } },
    }
    const configB: RouteRuleRuntimeConfig = {
      app: { baseURL: '/' },
      nitro: { routeRules: { '/docs/**': { ogImage: { title: 'B' } } } },
    }
    const configPrefixed: RouteRuleRuntimeConfig = {
      app: { baseURL: '/prefix/' },
      nitro: { routeRules: { '/docs/**': { ogImage: { title: 'A' } } } },
    }

    expect(getMatcher(configA)('/docs/intro').ogImage).toEqual({ title: 'A' })
    expect(getMatcher(configB)('/docs/intro').ogImage).toEqual({ title: 'B' })
    expect(getMatcher(configPrefixed)('/prefix/docs/intro').ogImage).toEqual({ title: 'A' })
    expect(spy).toHaveBeenCalledTimes(3)
  })
})

describe('routeRuleOgImage plugin', () => {
  it('reuses the cached matcher across repeated SSR renders with cloned runtimeConfig', async () => {
    const baseConfig: RouteRuleRuntimeConfig = {
      app: { baseURL: '/' },
      nitro: {
        routeRules: buildRouteRules(100, {
          '/blog/**': { ogImage: { component: 'BlogCard' } },
        }),
      },
    }

    for (const path of ['/blog/first', '/blog/second', '/blog/third']) {
      const { nuxtApp, ssrContext, hooks } = createMockNuxtApp({
        path,
        runtimeConfig: structuredClone(baseConfig),
      })
      await (routeRuleOgImage as any)(nuxtApp)
      await hooks.callHook('app:rendered', { ssrContext })
    }

    expect(mocks.createNitroRouteRuleMatcher).toHaveBeenCalledTimes(1)
    expect(mocks.createOgImageMeta).toHaveBeenCalledTimes(3)
  })

  it.each([
    ['ssrContext.error (error.vue render)', { ssrError: true, payloadError: { statusCode: 404 } }],
    ['ssrContext.payload.error (aborted 404 render)', { ssrError: false, payloadError: { statusCode: 404 } }],
    ['nuxtApp.payload.error (useError 500)', { ssrError: false, nuxtPayloadError: { statusCode: 500 } }],
    ['H3 v1 statusCode 404', { event: { node: { res: { statusCode: 404 } } } }],
    ['H3 v2 status 500', { event: { res: { status: 500 } } }],
    ['H3 v2 Node status 404 with node.res.statusCode 200', { event: { node: { res: { statusCode: 200 } }, res: { status: 404 } } }],
  ])('skips route-rule resolution on error pages: %s', async (_label, overrides) => {
    const { nuxtApp, ssrContext, event, hooks } = createMockNuxtApp({
      path: '/missing-page',
      runtimeConfig: {
        app: { baseURL: '/' },
        nitro: { routeRules: { '/**': { ogImage: { component: 'Default' } } } },
      },
      ...overrides,
    })

    await (routeRuleOgImage as any)(nuxtApp)
    await hooks.callHook('app:rendered', { ssrContext })

    expect(mocks.createNitroRouteRuleMatcher).not.toHaveBeenCalled()
    expect(mocks.createOgImageMeta).not.toHaveBeenCalled()
    expect(event.context._ogImageErrorPage).toBe(true)
  })
})

describe('ogImageCanonicalUrls plugin', () => {
  it('canonicalizes relative og:image URLs on normal 200 pages', async () => {
    const { nuxtApp, ssrContext, head, hooks } = createMockNuxtApp({
      path: '/article',
      event: { node: { res: { statusCode: 200 } } },
    })
    head.push({
      title: 'My Article',
      meta: [{ property: 'og:image', content: '/custom.png' }],
    })

    await (ogImageCanonicalUrls as any)(nuxtApp)
    await hooks.callHook('app:rendered', { ssrContext })

    const { headTags } = renderSSRHead(head)
    expect(headTags).toContain('content="https://example.com/custom.png"')
  })

  it.each([
    ['ssrContext.error (404 error.vue)', { ssrError: true, payloadError: { statusCode: 404 } }],
    ['ssrContext.payload.error (aborted 404 pass)', { ssrError: false, payloadError: { statusCode: 404 } }],
    ['nuxtApp.payload.error (500)', { ssrError: false, nuxtPayloadError: { statusCode: 500 } }],
    ['H3 v1 statusCode 404', { event: { node: { res: { statusCode: 404 } } } }],
    ['H3 v2 status 500', { event: { res: { status: 500 } } }],
    ['H3 v2 Node status 404 with node.res.statusCode 200', { event: { node: { res: { statusCode: 200 } }, res: { status: 404 } } }],
  ])('skips head plugin registration on error pages: %s', async (_label, overrides) => {
    const { nuxtApp, ssrContext, head, event, hooks } = createMockNuxtApp({
      path: '/missing',
      ...overrides,
    })
    const useSpy = vi.spyOn(head, 'use')
    head.push({
      meta: [{ property: 'og:image', content: '/custom.png' }],
    })

    await (ogImageCanonicalUrls as any)(nuxtApp)
    await hooks.callHook('app:rendered', { ssrContext })

    expect(useSpy).not.toHaveBeenCalled()
    expect(event.context._ogImageErrorPage).toBe(true)
    const { headTags } = renderSSRHead(head)
    expect(headTags).toContain('content="/custom.png"')
  })
})

describe('getEventStatusCode / isErrorResponseEvent', () => {
  it('prefers H3 v2 res.status over default Node node.res.statusCode 200', () => {
    const event = { node: { res: { statusCode: 200 } }, res: { status: 404 } }
    expect(getEventStatusCode(event)).toBe(404)
    expect(isErrorResponseEvent(event)).toBe(true)
  })

  it('falls back to H3 v1 node.res.statusCode when res.status is undefined', () => {
    const event = { node: { res: { statusCode: 404 } } }
    expect(getEventStatusCode(event)).toBe(404)
    expect(isErrorResponseEvent(event)).toBe(true)
  })

  it('returns false for normal 200 responses', () => {
    const event = { node: { res: { statusCode: 200 } }, res: { status: 200 } }
    expect(getEventStatusCode(event)).toBe(200)
    expect(isErrorResponseEvent(event)).toBe(false)
  })
})
