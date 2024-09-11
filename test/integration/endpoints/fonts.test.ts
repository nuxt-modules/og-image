import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../fixtures/basic'),
  server: true,
  build: true,
})
describe('fonts', () => {
  it('basic', async () => {
    const font = await $fetch('/__og-image__/font/Inter/400')
    expect(font).toMatchInlineSnapshot(`
      Blob {
        Symbol(kHandle): Blob {},
        Symbol(kLength): 338084,
        Symbol(kType): "font/ttf",
      }
    `)
  }, 60000)
})
