import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils'
import { describe, expect, it } from 'vitest'
import { encodeOgImageParams } from '../../src/runtime/shared/urlEncoding'

const { resolve } = createResolver(import.meta.url)
describe.skipIf(!import.meta.env?.TEST_DEV)('malformed URL parameter handling', async () => {
  await setup({
    rootDir: resolve('../fixtures/basic'),
    dev: true,
  })

  it('handles malformed encoded params gracefully', async () => {
    // Malformed encoded params (truncated or invalid)
    const response = await $fetch('/_og/d/w_1200,h_600,_path_satori,title_Hel.png').catch(() => false)
    expect(response).not.toBe(false)
  })

  it('still processes valid encoded params correctly', async () => {
    // Valid encoded params using the new Cloudinary-style format
    const encoded = encodeOgImageParams({ _path: '/satori', title: 'Hello World' })
    const response = await $fetch(`/_og/d/${encoded}.png`).catch(() => false)
    expect(response).not.toBe(false)
  })
})
