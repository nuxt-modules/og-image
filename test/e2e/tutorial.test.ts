import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { fetchOgImages } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/tutorial'),
  server: true,
  build: true,
  dev: false,
})

describe('tutorial steps', () => {
  it('all tutorial parts render', async () => {
    const images = await fetchOgImages('/part1', '/part2', '/part3', '/part3-custom')
    for (const [, buf] of images) {
      expect(buf.length).toBeGreaterThan(1000)
    }
  })
})
