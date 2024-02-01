import type { VNode } from '../../../../types'
import { defineSatoriTransformer } from '../utils'
import { decodeHtml } from '../../../util/encoding'

// automatically add missing flex rules
export default defineSatoriTransformer([
  // clean up
  {
    filter: (node: VNode) => node.props?.['data-v-inspector'],
    transform: async (node: VNode) => {
      delete node.props['data-v-inspector']
    },
  },
  {
    filter: (node: VNode) => typeof node.props?.children === 'string',
    transform: async (node: VNode) => {
      // for the payload, we unencode any html
      // unescape all html tokens
      node.props.children = decodeHtml(node.props.children as string)
    },
  },
])
