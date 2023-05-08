// @vitest-environment node

import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

const { resolve } = createResolver(import.meta.url)

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toMatchImageSnapshot(): R
    }
  }
}

await setup({
  rootDir: resolve('../.playground'),
  build: true,
  server: true,
})

expect.extend({ toMatchImageSnapshot })

describe('build', () => {
  it('basic', async () => {
    async function fetchImage(url: string, options: any = {}) {
      const blob: Blob = await $fetch(url, options)
      return Buffer.from(await blob.arrayBuffer())
    }

    expect(await fetchImage('/__og_image__/og.png')).toMatchImageSnapshot()

    expect(await fetchImage('/satori/image/__og_image__/og.png')).toMatchImageSnapshot()
    expect(await fetchImage('/satori/with-options/__og_image__/og.png')).toMatchImageSnapshot()
    expect(await fetchImage('/satori/tailwind/__og_image__/og.png', { query: { title: 'Fully dynamic', bgColor: 'bg-green-500' } })).toMatchImageSnapshot()

    expect(await fetchImage('/browser/component/__og_image__/og.png')).toMatchImageSnapshot()
  }, 60000)
})
