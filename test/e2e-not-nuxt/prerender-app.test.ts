import * as fs from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
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

describe('prerender', () => {
  it('basic', async () => {
    // use execa to run `nuxi generate` in the rootDir
    await execa('nuxt', ['generate'], { cwd: resolve('../fixtures/app-dir') })
    // use globby and fs tools to read the images
    const imagePath = resolve('../fixtures/app-dir/.output/public/__og-image__')
    // globby in image path
    const images = await globby('**/*.png', { cwd: imagePath }).then((r: string[]) => r.sort())
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
