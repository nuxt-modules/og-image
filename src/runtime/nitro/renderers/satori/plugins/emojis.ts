import type { VNode } from '../../../../../types'
import { defineSatoriTransformer } from '../utils'

function isEmojiFilter(node: VNode) {
  return node.type === 'img'
  && node.props?.class?.includes('emoji')
}

export default defineSatoriTransformer(() => {
  return [
    // need to make sure parent div has flex for the emoji to render inline
    {
      filter: (node: VNode) =>
        node.type === 'div' && Array.isArray(node.props?.children) && (node.props.children as VNode[]).some(isEmojiFilter),
      transform: async (node: VNode) => {
        node.props.style = node.props.style || {}
        node.props.style.display = 'flex'
        node.props.style.alignItems = 'center'
      },
    },
    {
      filter: isEmojiFilter,
      transform: async (node: VNode) => {
        node.props.style = node.props.style || {}
        node.props.style.height = '1em'
        node.props.style.width = '1em'
        node.props.style.margin = '0 .3em 0 .3em'
        node.props.style.verticalAlign = '0.1em'
        node.props.class = ''
      },
    },
  ]
})
