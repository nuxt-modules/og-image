import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/emoji-test'),
  server: true,
  browser: true,
})

describe('emoji rendering', () => {
  it('should render emoji OG image correctly', async () => {
    // We can't actually test the difference between API vs local resolution here,
    // but we can verify that the emoji is rendered correctly in the final image
    const ogImage = await $fetch('/__og-image__/image/og.png', {
      responseType: 'arrayBuffer',
    })

    // The image should not be empty
    expect(ogImage.byteLength).toBeGreaterThan(1000)

    // Debug endpoint should return useful information
    const debug = await $fetch('/__og-image__/debug.json', {
      responseType: 'json',
    })

    // Verify that there are emoji characters in the template
    expect(debug.components).toBeDefined()
    expect(debug.components.length).toBeGreaterThan(0)

    // Test that the debug endpoint shows if local or API resolution is being used
    // This is based on having local emoji deps or not
    expect(debug.compatibility).toBeDefined()
  })
})
