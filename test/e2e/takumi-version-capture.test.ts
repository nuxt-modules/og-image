import * as fs from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { fetchOgImage } from '../utils'

const { resolve } = createResolver(import.meta.url)
const captureDir = process.env.TAKUMI_CAPTURE_DIR

const routes = [
  ['basic', '/prefix/takumi'],
  ['simple', '/prefix/comparison/takumi'],
  ['complex', '/prefix/comparison/complex-takumi'],
  ['calc', '/prefix/takumi/calc'],
  ['ellipsis', '/prefix/takumi/ellipsis'],
  ['image', '/prefix/takumi/image'],
  ['css-vars', '/prefix/takumi/css-vars'],
  ['github-avatars', '/prefix/takumi/github-avatars'],
] as const

if (captureDir) {
  await setup({
    rootDir: resolve('../fixtures/basic'),
    server: true,
    build: true,
    nuxtConfig: {
      app: {
        baseURL: '/prefix/',
      },
    },
  })
}

describe.skipIf(!captureDir)('takumi version capture', () => {
  it('captures representative takumi renders', async () => {
    await fs.rm(captureDir!, { force: true, recursive: true })
    await fs.mkdir(captureDir!, { recursive: true })

    for (const [name, route] of routes) {
      const image = await fetchOgImage(route)
      expect(image.byteLength).toBeGreaterThan(0)
      await fs.writeFile(join(captureDir!, `${name}.png`), image)
    }

    await fs.writeFile(
      join(captureDir!, 'manifest.json'),
      `${JSON.stringify({
        version: process.env.TAKUMI_VERSION_UNDER_TEST,
        routes: Object.fromEntries(routes),
      }, null, 2)}\n`,
    )
  }, 120000)
})
