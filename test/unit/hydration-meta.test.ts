import type { VueHeadClient } from '@unhead/vue'
import type { NuxtSSRContext } from 'nuxt/app'
import type { OgImageOptionsInternal } from '../../src/runtime/types'
import { useSeoMeta, useHead as vueUseHead } from '@unhead/vue'
import { createHead as createClientHead, renderDOMHead } from '@unhead/vue/client'
import { InferSeoMetaPlugin, TemplateParamsPlugin } from '@unhead/vue/plugins'
import { createHead as createServerHead, renderSSRHead } from '@unhead/vue/server'
import { parse, stringify } from 'devalue'
import { Window } from 'happy-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, h, ref } from 'vue'
import { defineOgImageRaw } from '../../src/runtime/app/composables/_defineOgImageRaw'
import { createOgImageMeta, setHeadOgImagePrebuilt } from '../../src/runtime/app/utils'

const document = new Window().document as unknown as Document

const mocks = vi.hoisted(() => ({
  head: undefined as unknown as VueHeadClient,
  state: new Map<string, { value: unknown }>(),
  rendered: [] as (() => void)[],
  app: { isHydrating: true },
  config: {
    'app': { baseURL: '/', cdnURL: '' },
    'public': { 'nuxt-og-image': {} },
    'nuxt-og-image': {
      defaults: { width: 1200, height: 600 },
      includeTwitter: true,
      security: { secret: '', strict: false },
    },
  },
}))

vi.mock('nuxt/app', () => ({
  injectHead: () => mocks.head,
  useHead: (input: Parameters<typeof vueUseHead>[0], options?: Parameters<typeof vueUseHead>[1]) => vueUseHead(input, { ...options, head: mocks.head }),
  useNuxtApp: () => ({ ...mocks.app, hook: (_name: string, callback: () => void) => mocks.rendered.push(callback) }),
  useRoute: () => ({ path: '/article', query: {} }),
  useRuntimeConfig: () => mocks.config,
  useState: (key: string, init: () => unknown) => {
    if (!mocks.state.has(key))
      mocks.state.set(key, ref(init()))
    return mocks.state.get(key)
  },
  useRequestEvent: () => undefined,
  useError: () => ref(),
  createError: (input: { message: string }) => new Error(input.message),
}))
vi.mock('#build/nuxt-og-image/client-config.mjs', () => ({ hasServerRuntime: true }))
vi.mock('#build/nuxt-og-image/component-hashes.mjs', () => ({ componentHashes: {}, defaultComponentName: 'Card' }))
vi.mock('#build/nuxt-og-image/components.mjs', () => ({ componentNames: [{ pascalName: 'Card', propNames: ['title'] }, { pascalName: 'ClipTakumi', kebabName: 'clip-takumi', renderer: 'takumi', propNames: [] }] }))
vi.mock('#site-config/app', () => ({
  createSitePathResolver: () => (path: string) => `https://example.com${path}`,
  withSiteUrl: (path: string) => `https://example.com${path}`,
}))

function card(): string | undefined {
  renderDOMHead(mocks.head)
  return document.querySelector<HTMLMetaElement>('meta[name="twitter:card"]')?.content
}

function images(): string[] {
  let urls: string[] = []
  const unhook = mocks.head.hooks!.hook('tags:afterResolve', ({ tags }) => {
    urls = tags.filter(tag => tag.props.property === 'og:image').map(tag => String(tag.props.content))
  })
  mocks.head.dirty = true
  renderDOMHead(mocks.head)
  unhook()
  return urls
}

function hydrate() {
  for (const callback of mocks.rendered)
    callback()
  // Nuxt serializes its payload before resolving the server head.
  const payload = stringify(Object.fromEntries([...mocks.state].map(([key, state]) => [key, state.value])))
  document.head.innerHTML = renderSSRHead(mocks.head).headTags
  const state = parse(payload) as Record<string, unknown>
  mocks.state = new Map(Object.entries(state).map(([key, value]) => [key, ref(value)]))
  mocks.head = createClientHead({ document })
  // These are the plugins installed by nuxt-seo-utils' inferSeoMetaPlugin.
  mocks.head.use(TemplateParamsPlugin)
  mocks.head.use(InferSeoMetaPlugin())
  return payload
}

function defineServerImage(options: OgImageOptionsInternal, context = {} as NuxtSSRContext) {
  createOgImageMeta('/image.png', options, context, '/article', mocks.head)
}

beforeEach(() => {
  document.head.innerHTML = ''
  mocks.head = createServerHead()
  mocks.state.clear()
  mocks.rendered = []
  mocks.app.isHydrating = true
  mocks.config['nuxt-og-image'].includeTwitter = true
  mocks.config['nuxt-og-image'].security = { secret: '', strict: false }
  mocks.head.use(TemplateParamsPlugin)
  mocks.head.use(InferSeoMetaPlugin())
})

describe('hydration image metadata', () => {
  it.each([true, false])('keeps the server image and card with includeTwitter=%s', (includeTwitter) => {
    mocks.config['nuxt-og-image'].includeTwitter = includeTwitter
    defineServerImage({ component: 'Card' })
    useSeoMeta({ title: 'Article', description: 'Description' }, { head: mocks.head })
    hydrate()
    const serverImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')!.content
    defineOgImageRaw({ component: 'Card' })
    expect(images()).toEqual([serverImage])
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:image"]')!.content).toBe(serverImage)
    expect(document.querySelector('meta[name="twitter:image"]') !== null).toBe(includeTwitter)
    expect(card()).toBe('summary_large_image')
    mocks.app.isHydrating = false
    defineOgImageRaw({ url: 'https://example.com/next.png' })
    expect(images()).toEqual(['https://example.com/next.png'])
  })

  it('keeps prebuilt URLs and an explicit card choice', () => {
    setHeadOgImagePrebuilt({ url: 'https://cdn.example.com/static.png' })
    hydrate()
    mocks.head.push({ meta: [{ name: 'twitter:card', content: 'summary' }] })
    defineOgImageRaw({ url: 'https://cdn.example.com/static.png' })
    expect(images()).toEqual(['https://cdn.example.com/static.png'])
    expect(card()).toBe('summary')
  })

  it('keeps separate image variants through repeated hydration calls', () => {
    const context = {} as NuxtSSRContext
    defineServerImage({ component: 'Card', props: { title: 'Wide' } }, context)
    defineServerImage({ component: 'Card', key: 'square', width: 600 }, context)
    hydrate()
    const serverImages = [...document.querySelectorAll<HTMLMetaElement>('meta[property="og:image"]')].map(tag => tag.content)
    defineOgImageRaw([{ component: 'Card' }, { component: 'Card', key: 'square' }, false])
    defineOgImageRaw({ component: 'Card' })
    expect(images()).toEqual(serverImages)
    expect(serverImages).toHaveLength(2)
    mocks.app.isHydrating = false
    defineOgImageRaw({ key: 'square', url: 'https://example.com/square.png' })
    expect(images()).toEqual(['https://example.com/square.png'])
  })

  it('does not register an image for a disabled call', () => {
    setHeadOgImagePrebuilt({ url: 'https://cdn.example.com/static.png' })
    hydrate()
    defineOgImageRaw(false)
    expect(images()).toEqual([])
  })

  it('keeps the signed server URL without sending its signing key', () => {
    const secret = 'fixture-only-signing-key'
    mocks.config['nuxt-og-image'].security = { secret, strict: true }
    defineServerImage({ component: 'Card' })
    useSeoMeta({ title: 'Late title' }, { head: mocks.head })
    const payload = hydrate()
    const serverImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')!.content
    defineOgImageRaw({ component: 'Card' })
    expect(images()).toEqual([serverImage])
    expect(decodeURIComponent(serverImage)).toContain('Late+title')
    expect(payload.includes(secret)).toBe(false)
  })

  it('does not create image tags when the server emitted none', () => {
    hydrate()
    defineOgImageRaw({ component: 'Card' })
    expect(images()).toEqual([])
  })

  it('removes hydrated image tags when their page unmounts', () => {
    setHeadOgImagePrebuilt({ url: 'https://cdn.example.com/static.png' })
    hydrate()
    const renderer = createRenderer<Node, Element>({
      createElement: tag => document.createElement(tag),
      createText: text => document.createTextNode(text),
      createComment: text => document.createComment(text),
      insert: (child, parent, anchor) => parent.insertBefore(child, anchor || null),
      remove: node => node.parentNode?.removeChild(node),
      setText: (node, text) => { node.nodeValue = text },
      setElementText: (element, text) => { element.textContent = text },
      parentNode: node => node.parentElement,
      nextSibling: node => node.nextSibling,
      patchProp: (element, key, _previous, next) => element.setAttribute(key, String(next)),
    })
    const app = renderer.createApp({
      setup() {
        defineOgImageRaw({ url: 'https://cdn.example.com/static.png' })
        return () => h('main')
      },
    })
    app.mount(document.createElement('div'))
    expect(images()).toEqual(['https://cdn.example.com/static.png'])
    app.unmount()
    expect(images()).toEqual([])
  })
})

describe('server og:video tags', () => {
  function videoTag() {
    for (const callback of mocks.rendered)
      callback()
    return renderSSRHead(mocks.head).headTags.match(/<meta property="og:video" content="([^"]+)"/)?.[1]
  }

  it('advertises no runtime video when URL signing is off', () => {
    defineServerImage({ component: 'ClipTakumi', video: true })
    expect(videoTag()).toBeUndefined()
  })

  it('advertises the runtime video when URL signing is on', () => {
    mocks.config['nuxt-og-image'].security = { secret: 'test-secret', strict: false }
    defineServerImage({ component: 'ClipTakumi', video: true })
    expect(videoTag()).toMatch(/\.mp4$/)
  })
})
