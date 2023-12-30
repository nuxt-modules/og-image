import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../../fixtures/basic'),
})

expect.extend({ toMatchImageSnapshot })

describe('png', () => {
  it('basic', async () => {
    const png: ArrayBuffer = await $fetch('/__og-image__/image/satori/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(png)).toMatchImageSnapshot()
  }, 60000)
})
