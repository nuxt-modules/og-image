import { describe, expect, it } from 'vitest'
import { getResolvedNuxtFonts, satoriSourceKey } from '../../src/build/fonts'

describe('getResolvedNuxtFonts', () => {
  it('gives each weight of a variable face its own Satori file', async () => {
    const src = '/_nuxt/fonts/inter.woff2'
    const fonts = await getResolvedNuxtFonts({} as any, {
      requiredWeights: [400, 700],
      fontState: {
        fallbackMap: new Map(),
        sourceMap: new Map([
          [satoriSourceKey(src, 400), '/_og-static-fonts/inter-400.ttf'],
          [satoriSourceKey(src, 700), '/_og-static-fonts/inter-700.ttf'],
        ]),
        resolvedFaces: new Map([['Inter', [{ src: [{ url: src, format: 'woff2' }], weight: [100, 900] }]]]),
      },
    })

    expect(fonts.map(font => [font.weight, font.src, font.satoriSrc])).toEqual([
      [400, src, '/_og-static-fonts/inter-400.ttf'],
      [700, src, '/_og-static-fonts/inter-700.ttf'],
    ])
  })
})
