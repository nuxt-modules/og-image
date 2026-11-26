import type { VueHeadClient } from '@unhead/vue'
import type { NuxtSSRContext } from 'nuxt/app'
import { createHead as createServerHead, renderSSRHead } from '@unhead/vue/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createOgImageMeta, getOgImagePath as getAppOgImagePath } from '../../src/runtime/app/utils'
import { initializeOgImageSigning } from '../../src/runtime/server/signing-secret'
import { getOgImagePath as getServerOgImagePath } from '../../src/runtime/server/utils'
import { signEncodedParams } from '../../src/runtime/shared'

const mocks = vi.hoisted(() => ({
  head: undefined as unknown as VueHeadClient,
  rendered: [] as (() => void)[],
  state: new Map<string, { value: unknown }>(),
  derive: vi.fn<(purpose: string) => Promise<string>>(),
  config: {
    'app': { baseURL: '/', cdnURL: '' },
    'appSecret': '',
    'public': { 'nuxt-og-image': {} },
    'nuxt-og-image': {
      defaults: { width: 1200, height: 600, extension: 'png' },
      includeTwitter: true,
      prerenderDynamicUrls: false,
      security: { secret: '' as string | false, strict: false },
    },
  },
}))

vi.mock('nuxt/app', () => ({
  useHead: (input: any, options?: any) => mocks.head.push(input, options),
  useNuxtApp: () => ({ hook: (_name: string, callback: () => void) => mocks.rendered.push(callback) }),
  useRequestEvent: () => undefined,
  useRuntimeConfig: () => mocks.config,
  useState: (key: string, init: () => unknown) => {
    if (!mocks.state.has(key))
      mocks.state.set(key, ref(init()))
    return mocks.state.get(key)
  },
}))

vi.mock('nuxt/server', () => ({
  useRuntimeConfig: () => mocks.config,
  deriveSecret: mocks.derive,
  createError: (options: { message: string }) => new Error(options.message),
}))

vi.mock('#build/nuxt-og-image/components.mjs', () => ({
  componentNames: [{ pascalName: 'Card', kebabName: 'card', propNames: ['title'] }],
}))

vi.mock('#og-image-virtual/component-names.mjs', () => ({
  componentNames: [{ pascalName: 'Card', kebabName: 'card', propNames: ['title'] }],
}))

vi.mock('#site-config/app', () => ({
  createSitePathResolver: () => (path: string) => `https://example.com${path}`,
  withSiteUrl: (path: string) => `https://example.com${path}`,
}))

function resolveOgImageMeta(options: Record<string, any>, prerenderPaths = new Map<string, string>()) {
  const ssrContext = {
    event: { context: { _ogImagePrerenderPaths: prerenderPaths } },
  } as unknown as NuxtSSRContext
  createOgImageMeta('/image.png', options, ssrContext, '/article', mocks.head)
  for (const callback of mocks.rendered)
    callback()
  const html = renderSSRHead(mocks.head).headTags
  return html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]
}

beforeEach(() => {
  mocks.head = createServerHead()
  mocks.rendered = []
  mocks.state.clear()
  mocks.derive.mockReset()
  mocks.config.appSecret = ''
  mocks.config['nuxt-og-image'] = {
    defaults: { width: 1200, height: 600, extension: 'png' },
    includeTwitter: true,
    prerenderDynamicUrls: false,
    security: { secret: '', strict: false },
  }
})

describe('prerender URL and signing mode', () => {
  it('keeps static /_og/s/ URLs during prerender even when security.strict is true', () => {
    mocks.config['nuxt-og-image'].security = { secret: 'derived-secret', strict: true }
    mocks.config['nuxt-og-image'].prerenderDynamicUrls = false

    const appResult = getAppOgImagePath('/article', { component: 'Card' })
    expect(appResult.path).toMatch(/^\/_og\/s\//)
    expect(appResult.path).not.toContain(',s_')

    const serverResult = getServerOgImagePath({ context: { _ogImageSigningSecret: 'derived-secret' } }, '/article', { component: 'Card' })
    expect(serverResult.path).toMatch(/^\/_og\/s\//)
    expect(serverResult.path).not.toContain(',s_')

    const prerenderPaths = new Map<string, string>()
    const metaUrl = resolveOgImageMeta({ component: 'Card' }, prerenderPaths)
    expect(metaUrl).toMatch(/^https:\/\/example\.com\/_og\/s\//)
    expect(prerenderPaths.get('og')).toMatch(/^\/_og\/s\//)
  })

  it('skips secret derivation during static prerender even when security.strict is true', async () => {
    mocks.config['nuxt-og-image'].security = { secret: '', strict: true }
    mocks.config['nuxt-og-image'].prerenderDynamicUrls = false
    mocks.derive.mockRejectedValue(new Error('Missing appSecret'))

    const event = { context: {} as Record<string, unknown> }
    await expect(initializeOgImageSigning(event)).resolves.toBeUndefined()
    expect(event.context._ogImageSigningSecret).toBeUndefined()
    expect(mocks.derive).not.toHaveBeenCalled()
  })

  it('emits signed dynamic /_og/d/ URLs and derives secret when prerenderDynamicUrls is true', async () => {
    const derivedSecret = 'derived-signing-secret-for-dynamic-prerender'
    mocks.config.appSecret = 'root-secret-with-at-least-32-characters-value'
    mocks.config['nuxt-og-image'].security = { secret: derivedSecret, strict: false }
    mocks.config['nuxt-og-image'].prerenderDynamicUrls = true
    mocks.derive.mockResolvedValue(derivedSecret)

    const event = { context: {} as Record<string, unknown> }
    await initializeOgImageSigning(event)
    expect(event.context._ogImageSigningSecret).toBe(derivedSecret)
    expect(mocks.derive).toHaveBeenCalledTimes(1)

    const appResult = getAppOgImagePath('/article', { component: 'Card' })
    expect(appResult.path).toMatch(/^\/_og\/d\/.+%2Cs_[\w-]+\.png$/)
    const [, appParams, appSig] = decodeURIComponent(appResult.path).match(/\/_og\/d\/(.+),s_([\w-]+)\.png$/)!
    expect(appSig).toBe(signEncodedParams(appParams, derivedSecret))

    const serverResult = getServerOgImagePath(event, '/article', { component: 'Card' })
    expect(serverResult.path).toMatch(/^\/_og\/d\/.+%2Cs_[\w-]+\.png$/)

    const prerenderPaths = new Map<string, string>()
    const metaUrl = resolveOgImageMeta({ component: 'Card' }, prerenderPaths)
    expect(metaUrl).toMatch(/^https:\/\/example\.com\/_og\/d\/.+%2Cs_[\w-]+\.png$/)
    expect(prerenderPaths.size).toBe(0)
  })
})
