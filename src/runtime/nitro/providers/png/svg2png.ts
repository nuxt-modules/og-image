import type { ConvertOptions } from 'svg2png-wasm'
import { initialize, svg2png } from 'svg2png-wasm'
import { wasmLoader } from '../../utils'

const Svg2PngLoader = wasmLoader('/* NUXT_OG_IMAGE_SVG2PNG_WASM */', '/svg2png.wasm')

export default async function (svg: string, options: ConvertOptions & { baseUrl: string }) {
  const Svg2PngWasm = await Svg2PngLoader.load({ baseUrl: options.baseUrl })
  await initialize(Svg2PngWasm).catch((e) => {
    if (!e.message.trim().endsWith('function can be used only once.'))
      throw e
  })
  return await svg2png(svg, options)
}
