import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { decodeOgImageParams } from '../../src/runtime/shared/urlEncoding'
import { extractOgImageUrl } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
})

/**
 * Extract encoded params segment from an OG image URL path.
 * URLs look like: /prefix/_og/d/w_1200,h_630,title_Hello+World.png
 */
function extractOgParams(ogUrl: string): Record<string, any> {
  const match = decodeURIComponent(ogUrl).match(/\/_og\/[ds]\/(.+)\.\w+$/)
  if (!match?.[1])
    return {}
  return decodeOgImageParams(match[1])
}

describe('useSeoMeta auto-injection', () => {
  it('injects title and description from useSeoMeta into OG image URL', async () => {
    const html = await $fetch('/satori/seo-meta-inject') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()
    const params = extractOgParams(ogUrl!)
    expect(params.props?.title).toBe('Auto Injected Title')
    expect(params.props?.description).toBe('Auto injected description from useSeoMeta')
  }, 60000)

  it('works regardless of call order (defineOgImage before useSeoMeta)', async () => {
    const html = await $fetch('/satori/seo-meta-inject-reverse') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()
    const params = extractOgParams(ogUrl!)
    expect(params.props?.title).toBe('Reverse Order Title')
    expect(params.props?.description).toBe('Reverse order description')
  }, 60000)

  it('explicit props win over useSeoMeta values', async () => {
    const html = await $fetch('/satori/seo-meta-inject-explicit') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()
    const params = extractOgParams(ogUrl!)
    expect(params.props?.title).toBe('Explicit Title')
    expect(params.props?.description).toBe('Explicit description')
  }, 60000)

  it('does not inject title/description when component does not declare them (#573)', async () => {
    const html = await $fetch('/satori/seo-meta-inject-undeclared') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()
    const params = extractOgParams(ogUrl!)
    expect(params.props?.title).toBeUndefined()
    expect(params.props?.description).toBeUndefined()
  }, 60000)

  it('does not inject title from plain useHead (only useSeoMeta) (#573)', async () => {
    const html = await $fetch('/satori/seo-meta-inject-usehead') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl).toBeTruthy()
    const params = extractOgParams(ogUrl!)
    expect(params.props?.title).toBeUndefined()
  }, 60000)
})

describe('twitter:card', () => {
  function twitterCards(html: string): string[] {
    return [...html.matchAll(/<meta name="twitter:card" content="([^"]*)"/g)].map(match => match[1]!)
  }

  it('defaults to summary_large_image', async () => {
    const html = await $fetch('/satori/seo-meta-inject') as string
    expect(twitterCards(html)).toEqual(['summary_large_image'])
  }, 60000)

  it('keeps the card type the page sets with useSeoMeta', async () => {
    const html = await $fetch('/satori/user-twitter-card') as string
    expect(extractOgImageUrl(html)).toBeTruthy()
    expect(twitterCards(html)).toEqual(['summary'])
  }, 60000)
})
