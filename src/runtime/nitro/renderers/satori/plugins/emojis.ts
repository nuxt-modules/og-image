import type { VNode } from '../../../../../types'
import { defineSatoriTransformer } from '../utils'

export default defineSatoriTransformer(() => {
  return {
    filter: (node: VNode) =>
      node.type === 'img'
      && node.props?.class?.includes('emoji'),
    transform: async (node: VNode) => {
      node.props.style = node.props.style || {}
      node.props.style.height = '1em'
      node.props.style.width = '1em'
      node.props.style.margin = '0 .05em 0 .1em'
      node.props.style.verticalAlign = '0.1em'
    },
  }
})
