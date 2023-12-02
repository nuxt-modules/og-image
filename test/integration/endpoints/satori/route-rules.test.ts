import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { fetch, setup } from '@nuxt/test-utils'
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
      responseType: 'arrayBuffer',
    })
    const headers = [...png.headers.entries()]
      .filter(([k]) => !['last-modified', 'date'].includes(k))
    expect(headers).toMatchInlineSnapshot(`
      [
        [
          "cache-control",
          "public, s-maxage=259200, stale-while-revalidate",
        ],
        [
          "connection",
          "keep-alive",
        ],
        [
          "content-length",
          "117173",
        ],
        [
          "content-type",
          "image/png",
        ],
        [
          "etag",
          "W/\\"TilXF3Idwk\\"",
        ],
        [
          "keep-alive",
          "timeout=5",
        ],
        [
          "vary",
          "accept-encoding, host",
        ],
      ]
    `)

    expect(Buffer.from(await png.arrayBuffer())).toMatchImageSnapshot()
  }, 60000)
  it('inline', async () => {
    const png: ArrayBuffer = await $fetch('/__og-image__/image/satori/route-rules/inline/og.png', {
      responseType: 'arrayBuffer',
      query: {
        purge: true,
      },
    })

    expect(Buffer.from(png)).toMatchImageSnapshot()
  }, 60000)
  it('config', async () => {
    const png: ArrayBuffer = await $fetch('/__og-image__/image/satori/route-rules/config/og.png', {
      responseType: 'arrayBuffer',
      query: {
        purge: true,
      },
    })

    expect(Buffer.from(png)).toMatchImageSnapshot()
  }, 60000)
})
