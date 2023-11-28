import { Buffer } from 'node:buffer'
import { withBase } from 'ufo'
import sizeOf from 'image-size'
import type { H3Event } from 'h3'
import type { VNode } from '../../../../types'
import { defineSatoriTransformer } from '../utils'
import { toBase64Image } from '../../../env/assets'

// for relative links we embed them as base64 input or just fix the URL to be absolute
export default defineSatoriTransformer({
  filter: (node: VNode) => node.type === 'img',
  transform: async (node: VNode, e: H3Event) => {
    const src = node.props?.src as string | null
    if (src) {
      let updated = false
      let dimensions
      if (!updated) {
        let valid = true

        // see if we can fetch it from a kv host if we're using an edge provider
        const response = (await e.$fetch(src, {
          baseURL: useNitroOrigin(e),
          responseType: 'arrayBuffer',
        })
          .catch(() => { valid = false }))
        if (valid) {
          node.props.src = toBase64Image(src, response as ArrayBuffer)
          const imageSize = sizeOf(Buffer.from(response as ArrayBuffer))
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
        node.props.src = `${withBase(src, `${useNitroOrigin(e)}`)}?${Date.now()}`
      }
    }
  },
})
