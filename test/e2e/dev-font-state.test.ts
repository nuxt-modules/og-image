import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { extractOgImageUrl } from '../utils'

const { resolve } = createResolver(import.meta.url)

async function resolvedFaces() {
  const debug = await $fetch('/_og/debug.json') as { resolvedFonts: Array<{ family: string, weight: number }> }
  return new Set(debug.resolvedFonts.map(font => `${font.family} ${font.weight}`))
}

// In dev, OG components are analysed lazily, so their font weights become known after Nitro has
// built the font list. Rebuilding Nitro for that restarted the server and dropped in-flight requests.
describe.skipIf(!import.meta.env?.TEST_DEV)('dev font state', async () => {
  await setup({
    rootDir: resolve('../fixtures/multi-font-families'),
    dev: true,
  })

  it('serves fonts found by component analysis without restarting the server', async () => {
    const bootId = await $fetch('/api/boot-id')
    const before = await resolvedFaces()

    const html = await $fetch('/variable-bold') as string
    const png: ArrayBuffer = await $fetch(extractOgImageUrl(html)!, { responseType: 'arrayBuffer' })
    expect(png.byteLength).toBeGreaterThan(0)

    // A restart lands seconds after the analysis; watch long enough to see one
    const seen = new Set([bootId])
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 250))
      seen.add(await $fetch('/api/boot-id').catch(() => bootId))
    }
    expect([...seen]).toEqual([bootId])

    const after = await resolvedFaces()
    expect([...before].filter(face => !after.has(face))).toEqual([])
    expect(after.size).toBeGreaterThan(before.size)
  })
}, 120000)
