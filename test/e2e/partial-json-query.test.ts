import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)
describe.skipIf(!import.meta.env?.TEST_DEV)('partial JSON query parameter handling', async () => {
  await setup({
    rootDir: resolve('../fixtures/basic'),
    dev: true,
  })

  it('handles malformed JSON in query parameters gracefully', async () => {
    // This is the problematic URL from the issue
    const response = await $fetch('/__og-image__/image/satori/og.png?_query=%7B%22utm_source%22').catch(() => false)
    expect(response).not.toBe(false)
  })

  it('still processes valid JSON queries correctly', async () => {
    // Test with valid JSON query
    const response = await $fetch('/__og-image__/image/satori/og.png?_query=%7B%22utm_source%22%3A%22facebook%22%7D').catch(() => false)
    expect(response).not.toBe(false)
  })
})
