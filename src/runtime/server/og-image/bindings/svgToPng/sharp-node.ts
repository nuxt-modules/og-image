import sharp from 'sharp'

export default {
  initWasmPromise: Promise.resolve(),
  svgToPng(svg: string, width?: number, height?: number): Promise<Buffer> {
    let pipeline = sharp(Buffer.from(svg))
    if (width && height)
      pipeline = pipeline.resize(width, height, { fit: 'fill' })
    return pipeline.png().toBuffer()
  },
}
