import { Resvg, ResvgRenderOptions } from '@resvg/resvg-js'

export default async function (svg: string, options: ResvgRenderOptions & { baseUrl: string }) {
  const resvgJS = new Resvg(svg, {})
  const pngData = resvgJS.render()
  return pngData.asPng()
}
