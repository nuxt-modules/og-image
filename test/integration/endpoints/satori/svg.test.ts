import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../../fixtures/basic'),
  dev: true,
  server: true,
})

describe('svg', () => {
  it('basic', async () => {
    const svg = await $fetch('/__og-image__/image/satori/og.svg')
    expect(svg).toMatchInlineSnapshot(`
      Blob {
        Symbol(kHandle): Blob {},
        Symbol(kLength): 14686,
        Symbol(kType): "image/svg+xml",
      }
    `)
  }, 60000)
})
