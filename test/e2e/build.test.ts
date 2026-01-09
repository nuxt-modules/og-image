import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
})

expect.extend({ toMatchImageSnapshot })

describe('build', () => {
  it.runIf(process.env.HAS_CHROME)('chromium tests', async () => {
    const chromium: ArrayBuffer = await $fetch('/_og/d/chromium/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(chromium)).toMatchImageSnapshot()
  })
  it('static images', async () => {
    const customFont: ArrayBuffer = await $fetch('/_og/s/satori/custom-font/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(customFont)).toMatchImageSnapshot()

    const image: ArrayBuffer = await $fetch('/_og/s/satori/image/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(image)).toMatchImageSnapshot()

    const defaults: ArrayBuffer = await $fetch('/_og/s/satori/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(defaults)).toMatchImageSnapshot()
  }, 60000)

  it('dynamic images', async () => {
    const inlineRouteRules: ArrayBuffer = await $fetch('/_og/d/satori/route-rules/inline/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(inlineRouteRules)).toMatchImageSnapshot()

    const overrideRouteRules: ArrayBuffer = await $fetch('/_og/d/satori/route-rules/config/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(overrideRouteRules)).toMatchImageSnapshot()

    const globalRouteRules: ArrayBuffer = await $fetch('/_og/d/satori/route-rules/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(globalRouteRules)).toMatchImageSnapshot()
  })
})
