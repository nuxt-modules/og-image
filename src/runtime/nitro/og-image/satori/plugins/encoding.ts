import { decodeHtml } from '../../../util/encoding'
import { defineSatoriTransformer } from '../utils'
import type { VNode } from '../../../../types'

// automatically add missing flex rules
export default defineSatoriTransformer([
  // clean up
  {
    filter: (node: VNode) => node.props?.['data-v-inspector'],
    transform: (node: VNode) => {
      delete node.props['data-v-inspector']
    },
  },
  {
    filter: (node: VNode) => typeof node.props?.children === 'string',
    transform: (node: VNode) => {
      // for the payload, we unencode any html
      // unescape all html tokens
      node.props.children = decodeHtml(node.props.children as string)
    },
  },
])
