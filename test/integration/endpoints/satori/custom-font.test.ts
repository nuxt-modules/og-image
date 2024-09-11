import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../../fixtures/basic'),
  server: true,
  build: true,
})

expect.extend({ toMatchImageSnapshot })

describe('custom font', () => {
  it('basic', async () => {
    const png: ArrayBuffer = await $fetch('/__og-image__/image/satori/custom-font/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(png)).toMatchImageSnapshot()
  }, 60000)
})
