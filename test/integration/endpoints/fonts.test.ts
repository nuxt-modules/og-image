import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../fixtures/basic'),
})
describe('fonts', () => {
  it('basic', async () => {
    const font = await $fetch('/__og-image__/font', {
      query: {
        name: 'Inter',
        weight: '400',
      },
    })
    expect(font).toMatchInlineSnapshot('"https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Au-0.ttf"')
  }, 60000)
})
