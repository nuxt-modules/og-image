import { Transformer } from '@napi-rs/image'

export default {
  initWasmPromise: Promise.resolve(),
  svgToPng(svg: string, width?: number, height?: number): Promise<Buffer> {
    const t = Transformer.fromSvg(svg)
    if (width && height)
      t.crop(0, 0, width, height)
    return t.png()
  },
}
