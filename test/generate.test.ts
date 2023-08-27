import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { execa } from "execa";

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
    const { resolve } = createResolver(import.meta.url)
    const rootDir = resolve('../.playground')
    // run nuxi generate on the playground dir using execa
    // send execa output to the main console
    await execa('nuxi', ['generate'], { cwd: rootDir, stdio: 'inherit', env: { NODE_ENV: 'production' }})

    function fetchImage(path: string) {
      return readFile(resolve(rootDir, `.output/public${path}`))
    }

    await new Promise(resolve => setTimeout(resolve, 1000))

    expect(await fetchImage('/__og_image__/og.png')).toMatchImageSnapshot({
      comparisonMethod: 'ssim',
      failureThreshold: 0.1,
      failureThresholdType: 'percent',
    })
    expect(await fetchImage('/satori/image/__og_image__/og.png')).toMatchImageSnapshot({
      comparisonMethod: 'ssim',
      failureThreshold: 0.1,
      failureThresholdType: 'percent',
    })
  }, 300000)
})
