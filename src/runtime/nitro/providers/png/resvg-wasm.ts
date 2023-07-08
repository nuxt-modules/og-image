import type { ResvgRenderOptions } from '@resvg/resvg-wasm'
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import { wasmLoader } from '../../utils'
import type { RuntimeOgImageOptions } from '../../../types'

const ReSvgLoader = wasmLoader('/* NUXT_OG_IMAGE_RESVG_WASM */', '/resvg.wasm')

export default async function (svg: string, options: ResvgRenderOptions & RuntimeOgImageOptions) {
  const ReSvgWasm = await ReSvgLoader.load(options)
  await initWasm(ReSvgWasm).catch(() => {})
  const resvgJS = new Resvg(svg, options)
  const pngData = resvgJS.render()
  return pngData.asPng()
}
