import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { encodeOgImageParams } from '../../src/runtime/shared/urlEncoding'

const { resolve } = createResolver(import.meta.url)

describe.skipIf(!import.meta.env?.TEST_DEV)('prop values containing file extensions', async () => {
  await setup({
    rootDir: resolve('../fixtures/basic'),
    dev: true,
  })

  // Regression: context.ts used String.replace(`.${extension}`, '') which replaces
  // the FIRST occurrence. When a prop value contains the same extension as the
  // output format AND there are other params after it, the extension inside the
  // prop gets stripped instead of the trailing one.
  it('preserves .html in prop value when output format is also .html', async () => {
    const encoded = encodeOgImageParams({
      component: 'PropTest.satori',
      props: { logo: 'https://example.com/page.html', title: 'test' },
      _path: '/satori',
    })
    const html = await $fetch(`/_og/d/${encoded}.html`) as string
    expect(html).toContain('https://example.com/page.html')
  }, 60000)
})
