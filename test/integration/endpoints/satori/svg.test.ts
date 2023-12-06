import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../../fixtures/basic'),
})
describe('svg', () => {
  it('basic', async () => {
    const svg = await $fetch('/__og-image__/image/satori/og.svg')
    expect(svg).toMatchInlineSnapshot(`
      Blob {
        Symbol(kHandle): Blob {},
        Symbol(kLength): 14657,
        Symbol(kType): "image/svg+xml",
      }
    `)
  }, 60000)
})
