import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

describe.skipIf(!import.meta.env?.TEST_DEV)('prebuilt image URL in dev', async () => {
  await setup({
    rootDir: resolve('../fixtures/basic'),
    dev: true,
  })

  it('keeps a query parameter on the absolute image URL', async () => {
    const html = await $fetch('/prebuilt-query') as string
    const imageUrl = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]
    expect(imageUrl).toBeTruthy()
    expect(new URL(imageUrl!).searchParams.get('variant')).toBe('one')
  })
})
