import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { extractOgImageUrl, fetchOgImage, setupImageSnapshots, SNAPSHOT_LOOSE } from '../utils'

const { resolve } = createResolver(import.meta.url)

// Regression: variable WOFF2 served by @nuxt/fonts used to render every
// font-weight at the same axis position when the takumi renderer was fed
// the same binary under multiple weight labels. The bug only surfaced in the
// prerender path (the user's Vercel deployment), so the fixture prerenders /.
// See `dedupeFontsByBinary` in src/runtime/server/og-image/takumi/renderer.ts.
await setup({
  rootDir: resolve('../fixtures/public-sans-repro'),
  server: true,
  build: true,
})

setupImageSnapshots(SNAPSHOT_LOOSE)

describe('takumi variable font weight rendering (prerender)', () => {
  it('uses the prerendered image path', async () => {
    const html = await $fetch('/') as string
    const ogUrl = extractOgImageUrl(html)
    expect(ogUrl, 'fixture should prerender / so the og image ends up at /_og/s/').toContain('/_og/s/')
  })

  it('renders bold and normal text at distinct weights from a single variable font', async () => {
    const image = await fetchOgImage('/')
    expect(image).toMatchImageSnapshot()
  })
})
