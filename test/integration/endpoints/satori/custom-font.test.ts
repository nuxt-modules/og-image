import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../../fixtures/basic'),
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
