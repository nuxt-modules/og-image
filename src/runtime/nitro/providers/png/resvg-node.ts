import type { ResvgRenderOptions } from '@resvg/resvg-js'
import { Resvg } from '@resvg/resvg-js'
import type { RuntimeOgImageOptions } from '../../../types'

export default async function (svg: string, options: ResvgRenderOptions & RuntimeOgImageOptions) {
  const resvgJS = new Resvg(svg, options)
  const pngData = resvgJS.render()
  return pngData.asPng()
}
