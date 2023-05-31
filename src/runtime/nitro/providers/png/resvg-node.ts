import type { ResvgRenderOptions } from '@resvg/resvg-js'
import { Resvg } from '@resvg/resvg-js'

export default async function (svg: string, options: ResvgRenderOptions & { baseUrl: string }) {
  const resvgJS = new Resvg(svg, options)
  const pngData = resvgJS.render()
  return pngData.asPng()
}
