import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { fetchOgImages, setupImageSnapshots, SNAPSHOT_LOOSE } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/multi-font-families'),
  server: true,
  build: true,
})

setupImageSnapshots(SNAPSHOT_LOOSE)

describe('multi-font-families', () => {
  it('renders all font family cards', async () => {
    const images = await fetchOgImages(
      '/',
      '/playfair',
      '/roboto',
      '/variable-bold',
      '/local-font',
      '/devanagari',
      '/devanagari-satori',
      '/takumi-variable-bold',
    )

    const snapshotIds: Record<string, string> = {
      '/': 'multi-font-lobster',
      '/playfair': 'multi-font-playfair',
      '/roboto': 'multi-font-jetbrains',
      '/variable-bold': 'multi-font-variable-bold',
      '/local-font': 'multi-font-local',
      '/devanagari': 'multi-font-devanagari-takumi',
      '/devanagari-satori': 'multi-font-devanagari-satori',
      '/takumi-variable-bold': 'multi-font-takumi-variable-bold',
    }

    for (const [path, id] of Object.entries(snapshotIds)) {
      expect(images.get(path)).toMatchImageSnapshot({
        customSnapshotIdentifier: id,
      })
    }
  })

  it('downloads static font files for variable font weights', async () => {
    const [font400, font700] = await Promise.all([
      $fetch('/_og-static-fonts/Nunito_Sans-400-normal.woff', { responseType: 'arrayBuffer' }) as Promise<ArrayBuffer>,
      $fetch('/_og-static-fonts/Nunito_Sans-700-normal.woff', { responseType: 'arrayBuffer' }) as Promise<ArrayBuffer>,
    ])
    expect(font400.byteLength).toBeGreaterThan(1000)
    expect(font700.byteLength).toBeGreaterThan(1000)
  })

  it('serves local font files from public directory', async () => {
    const [sansRegular, serifRegular, serifBold] = await Promise.all([
      $fetch('/fonts/LocalSans-Regular.ttf', { responseType: 'arrayBuffer' }) as Promise<ArrayBuffer>,
      $fetch('/fonts/LocalSerif-Regular.ttf', { responseType: 'arrayBuffer' }) as Promise<ArrayBuffer>,
      $fetch('/fonts/LocalSerif-Bold.ttf', { responseType: 'arrayBuffer' }) as Promise<ArrayBuffer>,
    ])
    expect(sansRegular.byteLength).toBeGreaterThan(1000)
    expect(serifRegular.byteLength).toBeGreaterThan(1000)
    expect(serifBold.byteLength).toBeGreaterThan(1000)
  })

  it('downloads static font files for Devanagari (non-Latin subset)', async () => {
    const font400: ArrayBuffer = await $fetch('/_og-static-fonts/Noto_Sans_Devanagari-400-normal.woff', { responseType: 'arrayBuffer' })
    expect(font400.byteLength).toBeGreaterThan(1000)
  })
}, 60000)
