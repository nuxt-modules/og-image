import * as fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import { globby } from 'globby'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { execa } from 'execa'

const { resolve } = createResolver(import.meta.url)

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
    const images = await globby('**/*', { cwd: imagePath })
    // for each image we run a snapshot test
    for (const image of images) {
      const imageBuffer = await fs.readFile(resolve(imagePath, image))
      expect(Buffer.from(imageBuffer)).toMatchImageSnapshot()
    }
  }, 60000)
})
