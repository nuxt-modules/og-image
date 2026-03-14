import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { fetchOgImage } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
})

describe('computed props', () => {
  it('renders page with computed props without crashing', async () => {
    const image = await fetchOgImage('/satori/computed')
    expect(image).toBeTruthy()
    expect(image.byteLength).toBeGreaterThan(0)
  }, 60000)
})
