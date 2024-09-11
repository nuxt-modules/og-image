import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../../fixtures/basic'),
  dev: true,
})

expect.extend({ toMatchImageSnapshot })

describe.skipIf(!process.env.RUN_FLAKY_TESTS)('image', () => {
  it('basic', async () => {
    const png: ArrayBuffer = await $fetch('/__og-image__/image/satori/image/og.png', {
      responseType: 'arrayBuffer',
    })

    expect(Buffer.from(png)).toMatchImageSnapshot()
  }, 60000)
})
