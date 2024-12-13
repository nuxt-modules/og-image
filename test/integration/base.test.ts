import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
  nuxtConfig: {
    app: {
      baseURL: '/prefix/',
    },
  },
})

expect.extend({ toMatchImageSnapshot })

describe('build', () => {
  it.runIf(process.env.HAS_CHROME)('chromium tests', async () => {
    const chromium: ArrayBuffer = await $fetch('/prefix/__og-image__/image/chromium/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(chromium)).toMatchImageSnapshot()
  })
  it('static images', async () => {
    const customFont: ArrayBuffer = await $fetch('/prefix/__og-image__/static/satori/custom-font/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(customFont)).toMatchImageSnapshot()

    const image: ArrayBuffer = await $fetch('/prefix/__og-image__/static/satori/image/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(image)).toMatchImageSnapshot()

    const defaults: ArrayBuffer = await $fetch('/prefix/__og-image__/static/satori/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(defaults)).toMatchImageSnapshot()
  }, 60000)

  it('dynamic images', async () => {
    const inlineRouteRules: ArrayBuffer = await $fetch('/prefix/__og-image__/image/satori/route-rules/inline/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(inlineRouteRules)).toMatchImageSnapshot()

    const overrideRouteRules: ArrayBuffer = await $fetch('/prefix/__og-image__/image/satori/route-rules/config/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(overrideRouteRules)).toMatchImageSnapshot()

    const globalRouteRules: ArrayBuffer = await $fetch('/prefix/__og-image__/image/satori/route-rules/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(globalRouteRules)).toMatchImageSnapshot()
  })
})
