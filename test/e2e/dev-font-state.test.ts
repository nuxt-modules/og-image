import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { extractOgImageUrl, setupImageSnapshots, SNAPSHOT_LOOSE } from '../utils'

const { resolve } = createResolver(import.meta.url)

async function fontDebug() {
  const debug = await $fetch('/_og/debug.json') as {
    resolvedFonts: Array<{ family: string, weight: number }>
    fontRequirements: { weights: number[] }
  }
  return { faces: new Set(debug.resolvedFonts.map(font => `${font.family} ${font.weight}`)), weights: debug.fontRequirements.weights }
}

// In dev, OG components are analysed lazily, so their font weights become known after Nitro has
// built the font list. Rebuilding Nitro for that restarted the server and dropped in-flight requests.
describe.skipIf(!import.meta.env?.TEST_DEV)('dev font state', async () => {
  await setup({
    rootDir: resolve('../fixtures/multi-font-families'),
    dev: true,
  })

  setupImageSnapshots(SNAPSHOT_LOOSE)

  it('serves fonts found by component analysis without restarting the server', async () => {
    const bootId = await $fetch('/api/boot-id')
    const before = await fontDebug()

    const html = await $fetch('/variable-bold') as string
    const png: ArrayBuffer = await $fetch(extractOgImageUrl(html)!, { responseType: 'arrayBuffer' })
    // The first render already uses Nunito Sans bold: same snapshot as the build-mode test
    expect(Buffer.from(png)).toMatchImageSnapshot({ customSnapshotIdentifier: 'multi-font-variable-bold' })

    // A restart lands seconds after the analysis; watch long enough to see one
    const seen = new Set([bootId])
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 250))
      seen.add(await $fetch('/api/boot-id').catch(() => bootId))
    }
    expect([...seen]).toEqual([bootId])

    // The faces and requirements analysis found after the build reach the runtime without a rebuild
    const after = await fontDebug()
    expect(after.faces.has('Nunito Sans 700')).toBe(true)
    expect([...before.faces].filter(face => !after.faces.has(face))).toEqual([])
    expect(after.faces.size).toBeGreaterThan(before.faces.size)
    expect(after.weights).toContain(700)
    expect(after.weights.length).toBeGreaterThan(before.weights.length)
  })
}, 120000)
