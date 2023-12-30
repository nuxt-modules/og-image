import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../../fixtures/basic'),
})

expect.extend({ toMatchImageSnapshot })

describe('route rules', () => {
  it('no define', async () => {
    const png = await fetch('/__og-image__/image/satori/route-rules/og.png?purge', {
      query: {
        purge: true,
      },
      // disable browser cache
      headers: {
        'Cache-Control': 'no-cache',
      },
      responseType: 'arrayBuffer',
    })

    // TODO test cache headers
    // const headers = [...png.headers.entries()]
    //   .filter(([k]) => !['last-modified', 'date'].includes(k))

    expect(Buffer.from(await png.arrayBuffer())).toMatchImageSnapshot()
  }, 60000)
  it('inline', async () => {
    const png: ArrayBuffer = await $fetch('/__og-image__/image/satori/route-rules/inline/og.png', {
      responseType: 'arrayBuffer',
      query: {
        purge: true,
      },
      // disable browser cache
      headers: {
        'Cache-Control': 'no-cache',
      },
    })

    expect(Buffer.from(png)).toMatchImageSnapshot()
  }, 60000)
  it.skip('config', async () => {
    const res = await fetch('/__og-image__/image/satori/route-rules/config/og.png', {
      responseType: 'arrayBuffer',
      query: {
        purge: true,
      },
      // disable browser cache
      headers: {
        'Cache-Control': 'no-cache',
      },
    })
    expect([...res.headers.entries()]).toMatchInlineSnapshot(`
      [
        [
          "cache-control",
          "no-cache, no-store, must-revalidate",
        ],
        [
          "connection",
          "keep-alive",
        ],
        [
          "content-length",
          "106537",
        ],
        [
          "content-type",
          "image/png",
        ],
        [
          "date",
          "Sun, 03 Dec 2023 05:49:11 GMT",
        ],
        [
          "expires",
          "0",
        ],
        [
          "keep-alive",
          "timeout=5",
        ],
        [
          "pragma",
          "no-cache",
        ],
        [
          "vary",
          "Accept-Encoding",
        ],
      ]
    `)
    const png = await res.arrayBuffer()
    expect(png).toMatchImageSnapshot()
  }, 60000)
})
