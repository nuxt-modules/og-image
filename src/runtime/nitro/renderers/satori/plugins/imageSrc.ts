import { withBase } from 'ufo'
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
      if (file) {
        node.props.src = file
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
          updated = true
        }
      }
      if (!updated) {
        // with query to avoid satori caching issue
        node.props.src = `${withBase(src, `${options.requestOrigin}`)}?${Date.now()}`
      }
    }
  },
})
