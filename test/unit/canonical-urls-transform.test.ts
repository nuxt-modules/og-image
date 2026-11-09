import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { canonicalUrlsCacheKey, createCanonicalUrlsPlugin, createCanonicalUrlsTransform } from '../../src/runtime/app/utils/plugins'

vi.mock('#build/nuxt-og-image/compiled-meta-server.mjs', () => ({ readEntry: undefined, withTagTransform: undefined }))
vi.mock('#build/nuxt-og-image/compiled-meta.mjs', () => ({ metaShapes: null, useCompiledHead: undefined }))
vi.mock('#build/nuxt-og-image/components.mjs', () => ({ componentNames: [] }))
vi.mock('#site-config/app', () => ({ createSitePathResolver: () => (path: string) => path, withSiteUrl: (path: string) => path }))
vi.mock('#app', () => ({ defineNuxtPlugin: (plugin: unknown) => plugin, useRequestEvent: () => undefined }))
vi.mock('nuxt/app', () => ({ injectHead: () => undefined, useHead: () => undefined, useRequestEvent: () => undefined, useRuntimeConfig: () => ({}) }))
vi.mock('nuxtseo-shared/server', () => ({ createNitroRouteRuleMatcher: () => () => ({}) }))

// og-image reaches Unhead through @unhead/vue, so the test resolves it from there
const requireFromVue = createRequire(join(realpathSync(fileURLToPath(new URL('../../node_modules/@unhead/vue', import.meta.url))), 'package.json'))
const { compileTags, dynamicValue, readEntry } = await import(requireFromVue.resolve('unhead/compiled'))
const { withTagTransform } = await import(requireFromVue.resolve('unhead/plugins'))
const { createHead: createCompiledHead, renderSSRHead: renderCompiled } = await import(requireFromVue.resolve('unhead/compiled/server'))
const { createHead, renderSSRHead } = await import(requireFromVue.resolve('unhead/server'))

const siteUrl = (path: string) => `https://example.com${path}`
const page = { title: dynamicValue(0), meta: [{ name: 'description', content: dynamicValue(1) }, { property: 'og:image', content: dynamicValue(2) }] }
const pageTags = (() => {
  const result = compileTags(page, { dynamicValues: 3 })
  if (result._tag !== 'Ok')
    throw new Error(result.reason)
  return result.tags
})()

// One page on a v3 head with the hook, and on a compiled server head with the transform
function renderBoth(image: string) {
  const values = ['Hello World', 'About it', image]
  const v3 = createHead({ disableDefaults: true })
  v3.use(createCanonicalUrlsPlugin(siteUrl))
  v3.push({ title: values[0], meta: [{ name: 'description', content: values[1] }, { property: 'og:image', content: values[2] }] })
  const compiled = createCompiledHead({ disableDefaults: true })
  compiled.use(createCanonicalUrlsTransform(compiled, { readEntry, withTagTransform }, siteUrl))
  compiled.push(pageTags, { values })
  return { off: renderSSRHead(v3), on: renderCompiled(compiled), head: compiled }
}

describe('canonical URLs transform', () => {
  it.each([
    'https://cdn.example.com/a.png',
    '/a b.png',
    '/_og/s/title_%title,description_%description.png',
    '',
  ])('renders the image %j as the hook does', (image) => {
    const { off, on } = renderBoth(image)
    expect(on).toEqual(off)
  })

  it('keys the memo on the site URL while every image URL is final', () => {
    const { head } = renderBoth('https://cdn.example.com/a.png')
    expect(canonicalUrlsCacheKey(head, readEntry, 'https://example.com/')).toBe('https://example.com/')
  })

  // The memo holds a token for a dynamic value, so an image URL the transform would change keeps the memo out
  it.each(['/a.png', 'https://cdn.example.com/a b.png', 'https://example.com/og?title=%title', ''])('keeps the memo out for the image %j', (image) => {
    const { head } = renderBoth(image)
    expect(canonicalUrlsCacheKey(head, readEntry, 'https://example.com/')).toBeNull()
  })
})
