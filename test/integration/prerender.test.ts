import * as fs from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import { execa } from 'execa'
import { globby } from 'globby'
import { configureToMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

const toMatchImageSnapshot = configureToMatchImageSnapshot({
  customDiffConfig: {
    threshold: 0.1,
  },
  failureThresholdType: 'percent',
  failureThreshold: 0.1,
})
expect.extend({ toMatchImageSnapshot })

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: false,
  dev: false,
  build: true,
  nuxtConfig: {
    _generate: true,
    // force prerender
    nitro: {
      static: true,
      preset: 'static',
      prerender: {
        routes: [
          '/satori/image',
        ],
      },
    },
  },
})

describe('prerender', () => {
  it('basic', async () => {
    // use execa to run `nuxi generate` in the rootDir
    await execa('nuxt', ['generate'], { cwd: resolve('../fixtures/basic') })
    // use globby and fs tools to read the images
    const imagePath = resolve('../fixtures/basic/.output/public/__og-image__')
    // globby in image path
    const images = await globby('**/*.png', { cwd: imagePath })
    // for each image we run a snapshot test
    for (const image of images) {
      const imageBuffer = await fs.readFile(resolve(imagePath, image))
      expect(imageBuffer).toMatchImageSnapshot({
        customDiffConfig: {
          threshold: 0.1,
        },
        failureThresholdType: 'percent',
        failureThreshold: 0.1,
      })
    }
  }, 60000)
})
