import { withBase } from 'ufo'
import type { VNode } from '../../../../../types'
import { defineSatoriTransformer } from '../utils'
import { useNitroApp } from '#internal/nitro'

// for relative links we embed them as base64 input or just fix the URL to be absolute
export default defineSatoriTransformer((url) => {
  return {
    filter: (node: VNode) => node.type === 'img',
    transform: async (node: VNode) => {
      const src = node.props?.src as string | null
      const nitroApp = useNitroApp()
      if (src && src.startsWith('/')) {
        // find the file using getAsset
        const response = (await nitroApp.localFetch(src)) as Response
        // see if we can fetch it from a kv host if we're using an edge provider
        if (response.status === 200)
          node.props.src = response.arrayBuffer()

        else node.props.src = withBase(src, `${url.protocol}//${url.host}`)
      }
    },
  }
})
