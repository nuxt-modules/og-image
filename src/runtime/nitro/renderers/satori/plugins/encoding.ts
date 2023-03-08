import type { VNode } from '../../../../../types'
import { defineSatoriTransformer } from '../utils'

// automatically add missing flex rules
export default defineSatoriTransformer(() => {
  return {
    filter: (node: VNode) => typeof node.props?.children === 'string',
    transform: async (node: VNode) => {
      // for the payload, we unencode any html
      // unescape all html tokens
      node.props.children = node.props.children
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, '\'')
        .replace(/&#x2F;/g, '/')
    },
  }
})
