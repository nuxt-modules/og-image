import { withBase } from 'ufo'
import type { VNode } from '../../../../../types'
import { defineSatoriTransformer } from '../utils'
import { readPublicAssetBase64 } from '../../../utils'

// for relative links we embed them as base64 input or just fix the URL to be absolute
export default defineSatoriTransformer((url) => {
  return {
    filter: (node: VNode) => node.type === 'img',
    transform: async (node: VNode) => {
      const src = node.props?.src as string | null
      if (src && src.startsWith('/')) {
        let updated = false
        const file = await readPublicAssetBase64(src)
        if (file) {
          node.props.src = file
          updated = true
        }
        if (!updated) {
          try {
            const response = (await globalThis.$fetch(src)) as Response
            // see if we can fetch it from a kv host if we're using an edge provider
            node.props.src = response.arrayBuffer()
            updated = true
          }
          catch (e) {
          }
        }
        if (!updated) {
          // find the file using getAsset
          try {
            const response = (await globalThis.$fetch.raw(src)) as Response
            // see if we can fetch it from a kv host if we're using an edge provider
            if (response.status === 200) {
              node.props.src = response.arrayBuffer()
              updated = true
            }
          }
          catch (e) {
          }
        }
        if (!updated) {
          // with query to avoid satori caching issue
          node.props.src = `${withBase(src, `${url.protocol}//${url.host}`)}?${Date.now()}`
        }
      }
    },
  }
})
