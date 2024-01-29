import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../fixtures/basic'),
})
describe('fonts', () => {
  it('basic', async () => {
    const font = await $fetch('/__og-image__/font/Inter/400')
    expect(font).toMatchInlineSnapshot(`
      Blob {
        Symbol(kHandle): Blob {},
        Symbol(kLength): 310808,
        Symbol(kType): "",
      }
    `)
  }, 60000)
})
