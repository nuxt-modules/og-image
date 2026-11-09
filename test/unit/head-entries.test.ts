import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { markOwnEntry, readHeadSeoProps } from '../../src/runtime/app/utils'
import { rewriteImageEntries } from '../../src/runtime/app/utils/plugins'

vi.mock('#build/nuxt-og-image/compiled-meta-server.mjs', async () => {
  const require = createRequire(join(realpathSync(fileURLToPath(new URL('../../node_modules/@unhead/vue', import.meta.url))), 'package.json'))
  const { readEntry } = await import(require.resolve('unhead/compiled'))
  return { readEntry }
})
vi.mock('#build/nuxt-og-image/compiled-meta.mjs', () => ({ metaShapes: null, useCompiledHead: undefined }))
vi.mock('#build/nuxt-og-image/components.mjs', () => ({ componentNames: [] }))
vi.mock('#site-config/app', () => ({ createSitePathResolver: () => (path: string) => path, withSiteUrl: (path: string) => path }))
vi.mock('#app', () => ({ defineNuxtPlugin: (plugin: unknown) => plugin, useRequestEvent: () => undefined }))
vi.mock('nuxt/app', () => ({ injectHead: () => undefined, useHead: () => undefined, useRequestEvent: () => undefined, useRuntimeConfig: () => ({}) }))
vi.mock('nuxtseo-shared/server', () => ({ createNitroRouteRuleMatcher: () => () => ({}) }))

// og-image reaches Unhead through @unhead/vue, so the test resolves it from there
const requireFromVue = createRequire(join(realpathSync(fileURLToPath(new URL('../../node_modules/@unhead/vue', import.meta.url))), 'package.json'))
const { compileTags, dynamicValue } = await import(requireFromVue.resolve('unhead/compiled'))
const { createHead: createCompiledHead } = await import(requireFromVue.resolve('unhead/compiled/server'))
const { createHead } = await import(requireFromVue.resolve('unhead/server'))
const { useSeoMeta, useHead } = await import(requireFromVue.resolve('unhead'))

function compiled(input: unknown, dynamicValues: number) {
  const result = compileTags(input, { dynamicValues })
  if (result._tag !== 'Ok')
    throw new Error(result.reason)
  return result.tags
}

const seoTags = compiled({ title: dynamicValue(0), meta: [{ name: 'description', content: dynamicValue(1) }] }, 2)
const imageTags = compiled({ meta: [{ property: 'og:image', content: dynamicValue(0) }] }, 1)
const siteUrl = (path: string) => `https://example.com${path}`

describe('readHeadSeoProps', () => {
  it('reads the title and description of a loose useSeoMeta entry', () => {
    const head = createHead({ disableDefaults: true })
    useHead(head, { title: 'Head title' })
    useSeoMeta(head, { title: () => 'Seo title', description: 'Seo description' })
    expect(readHeadSeoProps(head)).toEqual({ title: 'Seo title', description: 'Seo description' })
  })

  it('reads a compiled seoMeta entry whose values settle at the read', () => {
    const head = createCompiledHead({ disableDefaults: true })
    head.push(seoTags, { seoMeta: true, values: () => ['Compiled title', 'Compiled description'] })
    expect(readHeadSeoProps(head)).toEqual({ title: 'Compiled title', description: 'Compiled description' })
  })

  it('ignores useHead titles and the entries og-image pushed', () => {
    const head = createHead({ disableDefaults: true })
    useHead(head, { title: 'Head title' })
    const own = head.push({ meta: () => {
      throw new Error('og-image entry read')
    } })
    markOwnEntry(head, own)
    expect(readHeadSeoProps(head)).toEqual({})
  })
})

describe('rewriteImageEntries', () => {
  it('rewrites a compiled entry whose values settle at the read', () => {
    const head = createCompiledHead({ disableDefaults: true })
    head.push(imageTags, { values: () => ['/a b.png'] })
    expect(rewriteImageEntries(head, siteUrl)).toBe(true)
    expect(head.render().headTags).toContain('content="https://example.com/a+b.png"')
  })

  it('rewrites loose meta held in refs and getters', () => {
    const head = createCompiledHead({ disableDefaults: true })
    head.push({ title: 'Page', meta: [{ property: 'og:image', content: () => '/a.png' }] })
    expect(rewriteImageEntries(head, siteUrl)).toBe(true)
    const html = head.render().headTags
    expect(html).toContain('content="https://example.com/a.png"')
    expect(html).toContain('<title>Page</title>')
  })

  it('leaves useSeoMeta image keys to the hook', () => {
    const head = createCompiledHead({ disableDefaults: true })
    useSeoMeta(head, { ogImage: '/a.png' })
    expect(rewriteImageEntries(head, siteUrl)).toBe(false)
  })

  it('skips the entries og-image pushed', () => {
    const head = createCompiledHead({ disableDefaults: true })
    markOwnEntry(head, head.push({ meta: () => {
      throw new Error('og-image entry read')
    } }))
    expect(rewriteImageEntries(head, siteUrl)).toBe(true)
  })
})
