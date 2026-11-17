import type { H3Event } from '#nuxtseo/h3'
import { stringify } from 'devalue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPathHtmlAndExtractOptions } from '../../src/runtime/server/og-image/devtools'

const { fetchRawWithEvent } = vi.hoisted(() => ({ fetchRawWithEvent: vi.fn() }))

vi.mock('#nuxtseo/nitro', () => ({ fetchRawWithEvent }))
vi.mock('#nuxtseo/h3', () => ({ createError: (input: object) => Object.assign(new Error('HTTP error'), input) }))
vi.mock('#og-image-cache', () => ({ htmlPayloadCache: { getItem: async () => null, setItem: async () => undefined } }))

const options = [{ component: 'Example.takumi', width: 600, height: 315 }]
const html = `<html><head><meta property="og:title" content="Example"><meta property="og:image" content="https://example.com/og.png"></head><body><script id="nuxt-og-image-options">${stringify(options)}</script></body></html>`

function webEvent() {
  return { req: new Request('https://example.com/_og/d/page.json'), context: {} } as unknown as H3Event
}

beforeEach(() => vi.resetAllMocks())

describe('devtools page extraction', () => {
  it('extracts page options on a web event without a fetch method', async () => {
    fetchRawWithEvent.mockResolvedValue(new Response(html))

    const result = await fetchPathHtmlAndExtractOptions(webEvent(), '/example', 'example')

    expect(result).toMatchObject({ options, socialPreview: { root: { 'og:title': 'Example' } } })
  })

  it('extracts options after an internal redirect', async () => {
    fetchRawWithEvent.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/example' } }))
      .mockResolvedValueOnce(new Response(html))

    const result = await fetchPathHtmlAndExtractOptions(webEvent(), '/redirect', 'redirect')

    expect(result).toMatchObject({ options })
  })
})
