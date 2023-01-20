import { withBase } from 'ufo'
import type { VNode } from '../../../../../types'
import { defineSatoriTransformer, readPublicAssetBase64 } from '../utils'

// for relative links we embed them as base64 input or just fix the URL to be absolute
export default defineSatoriTransformer((url) => {
  return {
    filter: (node: VNode) => node.type === 'img',
    transform: async (node: VNode) => {
      const src = node.props?.src as string | null
      if (src && src.startsWith('/')) {
        // find the file using getAsset
        const file = readPublicAssetBase64(src)
        if (file)
          node.props.src = file
        else
          node.props.src = withBase(src, `${url.protocol}//${url.host}`)
      }
    },
  }
})
