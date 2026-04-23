import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { fetchOgImage, setupImageSnapshots, SNAPSHOT_LOOSE } from '../utils'

const { resolve } = createResolver(import.meta.url)

// Regression: variable WOFF2 served by @nuxt/fonts used to render every
// font-weight at the same axis position when the takumi renderer was fed
// the same binary under multiple weight labels. See dedupeFontsByBinary.
await setup({
  rootDir: resolve('../fixtures/public-sans-repro'),
  server: true,
  build: true,
})

setupImageSnapshots(SNAPSHOT_LOOSE)

describe('takumi variable font weight rendering', () => {
  it('renders bold and normal text at distinct weights from a single variable font', async () => {
    const image = await fetchOgImage('/')
    expect(image).toMatchImageSnapshot()
  })
})
