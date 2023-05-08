import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { buildNuxt, createResolver, loadNuxt } from '@nuxt/kit'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toMatchImageSnapshot(): R
    }
  }
}

expect.extend({ toMatchImageSnapshot })

describe('generate', () => {
  it('basic', async () => {
    process.env.NODE_ENV = 'production'
    process.env.prerender = true
    process.env.NUXT_PUBLIC_SITE_URL = 'https://nuxt-simple-sitemap.com'
    const { resolve } = createResolver(import.meta.url)
    const rootDir = resolve('../.playground')
    const nuxt = await loadNuxt({
      rootDir,
      overrides: {
        _generate: true,
      },
    })

    function fetchImage(path: string) {
      return readFile(resolve(rootDir, `.output/public${path}`))
    }

    await buildNuxt(nuxt)

    await new Promise(resolve => setTimeout(resolve, 1000))

    expect(await fetchImage('/__og_image__/og.png')).toMatchImageSnapshot()

    expect(await fetchImage('/satori/image/__og_image__/og.png')).toMatchImageSnapshot()
    expect(await fetchImage('/satori/with-options/__og_image__/og.png')).toMatchImageSnapshot()
    // doesn't work
    // expect(await fetchImage('/satori/tailwind/__og_image__/og.png')).toMatchImageSnapshot()
    //
    // expect(await fetchImage('/browser/component/__og_image__/og.png')).toMatchImageSnapshot({
    //   comparisonMethod: 'ssim',
    //   failureThreshold: 0.05,
    //   failureThresholdType: 'percent'
    // })
  }, 300000)
})
