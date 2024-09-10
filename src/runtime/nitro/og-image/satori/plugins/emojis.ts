import { defineSatoriTransformer } from '../utils'
import type { VNode } from '../../../../types'

function isEmojiFilter(node: VNode) {
  return node.type === 'svg'
    && typeof node.props?.['data-emoji'] !== 'undefined'
}

export default defineSatoriTransformer([
  // need to make sure parent div has flex for the emoji to render inline
  {
    filter: (node: VNode) =>
      ['div', 'p'].includes(node.type) && Array.isArray(node.props?.children) && (node.props.children as VNode[]).some(isEmojiFilter),
    transform: (node: VNode) => {
      node.props.style = node.props.style || {}
      node.props.style.display = 'flex'
      node.props.style.alignItems = 'center'
      // check if any children nodes are just strings, wrap in a div
      node.props.children = (node.props.children as VNode[]).map((child) => {
        if (typeof child === 'string') {
          return {
            type: 'div',
            props: {
              children: child,
            },
          }
        }
        if (child.props.class?.includes('emoji'))
          delete child.props.class
        return child
      })
    },
  },
])
