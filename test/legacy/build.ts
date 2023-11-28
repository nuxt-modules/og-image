// @vitest-environment node

import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { getOgImagePath } from '../src/runtime/utilts'

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
      const blob: Blob = await $fetch(getOgImagePath(url), options)
      return Buffer.from(await blob.arrayBuffer())
    }

    expect(await $fetch('/api/og-image-options', { query: { path: '/' } })).toMatchInlineSnapshot(`
      {
        "appName": "My App",
        "cache": true,
        "cacheTtl": 86400000,
        "component": "OgImageTemplateFallback",
        "description": "My description of the home page.",
        "height": 630,
        "path": "/",
        "provider": "satori",
        "themeColor": "#b5ffd6",
        "title": "Home & //<\\"With Encoding\\">\\\\",
        "width": 1200,
      }
    `)

    expect(await fetchImage('/')).toMatchImageSnapshot()

    expect(await fetchImage('/satori/image')).toMatchImageSnapshot()
    expect(await fetchImage('/satori/with-options')).toMatchImageSnapshot()
    expect(await fetchImage('/satori/tailwind', { query: { title: 'Fully dynamic', bgColor: 'bg-green-500' } })).toMatchImageSnapshot()

    // expect(await fetchImage('/browser/component/__og_image__/og.png')).toMatchImageSnapshot({
    //   comparisonMethod: 'ssim',
    //   failureThreshold: 0.05,
    //   failureThresholdType: 'percent'
    // })
  }, 60000)
})
