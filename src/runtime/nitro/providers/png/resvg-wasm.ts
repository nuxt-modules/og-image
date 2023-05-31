import type { ResvgRenderOptions } from '@resvg/resvg-wasm'
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import { wasmLoader } from '../../utils'

const ReSvgLoader = wasmLoader('/* NUXT_OG_IMAGE_RESVG_WASM */', '/resvg.wasm')

export default async function (svg: string, options: ResvgRenderOptions & { baseUrl: string }) {
  const ReSvgWasm = await ReSvgLoader.load({ baseUrl: options.baseUrl })
  await initWasm(ReSvgWasm).catch(() => {})
  const resvgJS = new Resvg(svg, options)
  const pngData = resvgJS.render()
  return pngData.asPng()
}
