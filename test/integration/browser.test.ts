import { createPage, setup } from '@nuxt/test-utils'
import { describe, expect, it } from 'vitest'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { createResolver } from '@nuxt/kit'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  buildDir: resolve('./build'),
  browser: true,
})

expect.extend({ toMatchImageSnapshot })

describe('browser', () => {
  it('basic', async () => {
    const page = await createPage('/__og-image__/image/og.png')
    const screenshot = await page.screenshot()

    expect(Buffer.from(screenshot)).toMatchImageSnapshot()
  })
})
