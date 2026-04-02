import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { fetchOgImages, setupImageSnapshots, SNAPSHOT_DEFAULT, SNAPSHOT_LOOSE } from '../utils'

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
      '/biz-udp-bold',
      '/font-black',
      '/font-black-takumi',
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
      // Case-insensitive font-family matching: template uses 'Biz UDPGothic',
      // @nuxt/fonts resolves as 'BIZ UDPGothic' — should still render correctly (#500)
      '/biz-udp-bold': 'multi-font-biz-udp-bold-takumi',
      '/font-black': 'multi-font-font-black',
      '/font-black-takumi': 'multi-font-font-black-takumi',
    }

    for (const [path, id] of Object.entries(snapshotIds)) {
      // Use tighter threshold for biz-udp-bold: the font-weight regression
      // (subset naming causing wrong weight) only produces ~0.7% pixel diff,
      // which the global SNAPSHOT_LOOSE (1%) would miss.
      const opts = path === '/biz-udp-bold'
        ? { customSnapshotIdentifier: id, ...SNAPSHOT_DEFAULT }
        : { customSnapshotIdentifier: id }
      expect(images.get(path)).toMatchImageSnapshot(opts)
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
