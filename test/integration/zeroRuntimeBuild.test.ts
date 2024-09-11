import fs, { readFile } from 'node:fs/promises'
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

describe('zeroRuntime', () => {
  it('basic', async () => {
    // use execa to run `nuxi generate` in the rootDir
    await execa('nuxt', ['build'], { cwd: resolve('../fixtures/zero-runtime') })
    // use globby and fs tools to read the images
    const serverOutputPath = resolve('../fixtures/zero-runtime/.output/server')
    // do a du -sh */
    const { stdout } = await execa('du', ['-sh', serverOutputPath])
    // eslint-disable-next-line style/no-tabs
    expect(stdout.split('	')[0]).toMatchInlineSnapshot(`"2.5M"`)
    const imagePath = resolve('../fixtures/zero-runtime/.output/public/__og-image__')
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
    const indexHtml = await readFile(resolve('../fixtures/zero-runtime/.output/public/index.html'), {
      encoding: 'utf-8',
    })
    // check the og:image tag src
    const ogImage = /<meta property="og:image" content="(.+?)">/.exec(indexHtml)
    expect(ogImage?.[1]).toMatchInlineSnapshot(`"https://nuxtseo.com/__og-image__/static/og.png"`)
  }, 60000)
})
