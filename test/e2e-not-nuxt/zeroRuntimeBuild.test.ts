import fs, { readFile, writeFile } from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
import { globby } from 'globby'
import { exec } from 'tinyexec'
import { afterEach, describe, expect, it } from 'vitest'
import { setupImageSnapshots, SNAPSHOT_STRICT } from '../utils'

const { resolve } = createResolver(import.meta.url)

setupImageSnapshots(SNAPSHOT_STRICT)

const fixtureDir = resolve('../fixtures/zero-runtime')
const nuxtConfigPath = resolve(fixtureDir, 'nuxt.config.ts')

describe('zeroRuntime', () => {
  let originalConfig: string | null = null

  afterEach(async () => {
    if (originalConfig) {
      await writeFile(nuxtConfigPath, originalConfig)
      originalConfig = null
    }
  })

  it('basic', async () => {
    await exec('nuxt', ['build'], { nodeOptions: { cwd: resolve('../fixtures/zero-runtime') } })
    const serverOutputPath = resolve('../fixtures/zero-runtime/.output/server')
    const { stdout } = await exec('du', ['-sh', serverOutputPath])
    // eslint-disable-next-line no-console,style/no-tabs
    console.log(`Size: ${stdout.split('	')[0]}`)
    const imagePath = resolve('../fixtures/zero-runtime/.output/public/_og')
    const images = await globby('**/*.png', { cwd: imagePath }).then((r: string[]) => r.sort())
    for (const image of images) {
      const imageBuffer = await fs.readFile(resolve(imagePath, image))
      expect(imageBuffer).toMatchImageSnapshot({
        customSnapshotIdentifier: image.replace(/[/\\]/g, '-').replace('.png', ''),
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
    const ogImage = /<meta property="og:image" content="(.+?)">/.exec(indexHtml)
    expect(ogImage?.[1]).toMatchInlineSnapshot(`"https://nuxtseo.com/_og/s/c_NuxtSeo.satori,title_Hello+World.png"`)
  }, 120000)

  it('local fonts in config', async () => {
    originalConfig = await readFile(nuxtConfigPath, 'utf-8')

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

    await exec('nuxt', ['cleanup'], { nodeOptions: { cwd: fixtureDir } })
    await exec('nuxt', ['build'], { nodeOptions: { cwd: fixtureDir } })

    const imagePath = resolve(fixtureDir, '.output/public/_og')
    const images = await globby('**/*.png', { cwd: imagePath })
    expect(images.length).toBeGreaterThan(0)

    const serverChunks = await globby('**/*.mjs', { cwd: resolve(fixtureDir, '.output/server/chunks') })
    const fontChunk = serverChunks.find(c => c.includes('OPTIEinstein'))
    expect(fontChunk).toBeUndefined()
  }, 120000)
})
