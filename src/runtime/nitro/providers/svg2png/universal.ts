import type { ConvertOptions } from 'svg2png-wasm'
import { initialize, svg2png } from 'svg2png-wasm'
import { wasmLoader } from '../../utils'

export default async function (svg: string, options: ConvertOptions & { baseUrl: string }) {
  const loader = wasmLoader('/* NUXT_OG_IMAGE_SVG2PNG_WASM */', '/svg2png.wasm', options.baseUrl)
  if (!(await loader.loaded())) {
    await initialize(await loader.load()).catch((e) => {
      if (!e.message.endsWith('function can be used only once.')) {
        throw e
      }
    })
  }
  return await svg2png(svg, options)
}
