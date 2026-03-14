import * as fs from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
import { globby } from 'globby'
import { exec } from 'tinyexec'
import { describe, expect, it } from 'vitest'
import { setupImageSnapshots, SNAPSHOT_STRICT } from '../utils'

const { resolve } = createResolver(import.meta.url)

setupImageSnapshots(SNAPSHOT_STRICT)

describe('prerender', () => {
  it('basic', async () => {
    await exec('nuxt', ['generate'], { nodeOptions: { cwd: resolve('../fixtures/app-dir') } })
    const imagePath = resolve('../fixtures/app-dir/.output/public/_og')
    const images = await globby('**/*.png', { cwd: imagePath }).then((r: string[]) => r.sort())
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
