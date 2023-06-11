import { Buffer } from 'node:buffer'
import { withBase } from 'ufo'
import sizeOf from 'image-size'
import type { RuntimeOgImageOptions, VNode } from '../../../../../types'
import { defineSatoriTransformer } from '../utils'
import { readPublicAssetBase64, toBase64Image } from '../../../utils'

// for relative links we embed them as base64 input or just fix the URL to be absolute
export default defineSatoriTransformer({
  filter: (node: VNode) => node.type === 'img',
  transform: async (node: VNode, options: RuntimeOgImageOptions) => {
    const src = node.props?.src as string | null
    if (src && src.startsWith('/')) {
      let updated = false
      const file = await readPublicAssetBase64(src)
      let dimensions
      if (file) {
        node.props.src = file.src
        dimensions = { width: file.width, height: file.height }
        updated = true
      }
      if (!updated) {
        let valid = true

        // see if we can fetch it from a kv host if we're using an edge provider
        const response = (await globalThis.$fetch(src, {
          responseType: 'arrayBuffer',
          baseURL: options.requestOrigin,
        }).catch(() => { valid = false }))
        if (valid) {
          node.props.src = toBase64Image(src, response as ArrayBuffer)
          const imageSize = await sizeOf(Buffer.from(response as ArrayBuffer))
          dimensions = { width: imageSize.width, height: imageSize.height }
          updated = true
        }
      }
      // apply a natural aspect ratio if missing a dimension
      if (dimensions?.width && dimensions?.height) {
        const naturalAspectRatio = dimensions.width / dimensions.height
        if (node.props.width && !node.props.height) {
          node.props.height = Math.round(node.props.width / naturalAspectRatio)
        }
        else if (node.props.height && !node.props.width) {
          node.props.width = Math.round(node.props.height * naturalAspectRatio)
        }
        else if (!node.props.width && !node.props.height) {
          node.props.width = dimensions.width
          node.props.height = dimensions.height
        }
      }
      if (!updated) {
        // with query to avoid satori caching issue
        node.props.src = `${withBase(src, `${options.requestOrigin}`)}?${Date.now()}`
      }
    }
  },
})
