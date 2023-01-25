import type { ResvgRenderOptions } from '@resvg/resvg-js'
import { Resvg } from '@resvg/resvg-js'

export default async function (svg: string, options: ResvgRenderOptions) {
  const resvg = new Resvg(svg, options)
  const pngData = resvg.render()
  return pngData.asPng()
}
