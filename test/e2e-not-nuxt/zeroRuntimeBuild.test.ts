import fs, { readFile, writeFile } from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
import { globby } from 'globby'
import { configureToMatchImageSnapshot } from 'jest-image-snapshot'
import { exec } from 'tinyexec'
import { afterEach, describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

const toMatchImageSnapshot = configureToMatchImageSnapshot({
  customDiffConfig: {
    threshold: 0.1,
  },
  failureThresholdType: 'percent',
  failureThreshold: 0.1,
})
expect.extend({ toMatchImageSnapshot })

const fixtureDir = resolve('../fixtures/zero-runtime')
const nuxtConfigPath = resolve(fixtureDir, 'nuxt.config.ts')

describe('zeroRuntime', () => {
  let originalConfig: string | null = null

  afterEach(async () => {
    // restore original config if modified
    if (originalConfig) {
      await writeFile(nuxtConfigPath, originalConfig)
      originalConfig = null
    }
  })

  it('basic', async () => {
    // use tinyexec to run `nuxi generate` in the rootDir
    await exec('nuxt', ['build'], { nodeOptions: { cwd: resolve('../fixtures/zero-runtime') } })
    // use globby and fs tools to read the images
    const serverOutputPath = resolve('../fixtures/zero-runtime/.output/server')
    // do a du -sh */
    const { stdout } = await exec('du', ['-sh', serverOutputPath])
    // eslint-disable-next-line no-console,style/no-tabs
    console.log(`Size: ${stdout.split('	')[0]}`)
    const imagePath = resolve('../fixtures/zero-runtime/.output/public/_og')
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
    const indexHtml = await readFile(resolve('../fixtures/zero-runtime/.output/public/index.html'), {
      encoding: 'utf-8',
    })
    // check the og:image tag src
    const ogImage = /<meta property="og:image" content="(.+?)">/.exec(indexHtml)
    expect(ogImage?.[1]).toMatchInlineSnapshot(`"https://nuxtseo.com/_og/s/title_Hello+World,q_e30,p_Ii8i.png"`)
  }, 120000)

  it('local fonts in config', async () => {
    // save original config
    originalConfig = await readFile(nuxtConfigPath, 'utf-8')

    // modify config to add local font
    const modifiedConfig = originalConfig.replace(
      'ogImage: {\n    zeroRuntime: true,\n    sharpOptions: true,\n  },',
      `ogImage: {
    zeroRuntime: true,
    sharpOptions: true,
    fonts: [
      {
        name: 'OPTIEinstein',
        weight: 800,
        path: '/OPTIEinstein-Black.otf',
      },
    ],
  },`,
    )
    await writeFile(nuxtConfigPath, modifiedConfig)

    // clean and build
    await exec('nuxt', ['cleanup'], { nodeOptions: { cwd: fixtureDir } })
    await exec('nuxt', ['build'], { nodeOptions: { cwd: fixtureDir } })

    // verify images were generated (build would fail if fonts couldn't be resolved)
    const imagePath = resolve(fixtureDir, '.output/public/_og')
    const images = await globby('**/*.png', { cwd: imagePath })
    expect(images.length).toBeGreaterThan(0)

    // verify font is NOT bundled in server output (zeroRuntime keeps bundle small)
    const serverChunks = await globby('**/*.mjs', { cwd: resolve(fixtureDir, '.output/server/chunks') })
    const fontChunk = serverChunks.find(c => c.includes('OPTIEinstein'))
    expect(fontChunk).toBeUndefined()
  }, 120000)
})
