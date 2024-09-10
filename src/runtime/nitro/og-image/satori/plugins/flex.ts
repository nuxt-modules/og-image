import { defineSatoriTransformer } from '../utils'
import type { VNode } from '../../../../types'

// automatically add missing flex rules
export default defineSatoriTransformer({
  filter: (node: VNode) =>
    node.type === 'div'
    && (Array.isArray(node.props?.children) && node.props?.children.length >= 1)
    && (!node.props.style?.display && !node.props?.class?.includes('hidden')),
  transform: (node: VNode) => {
    node.props.style = node.props.style || {}
    node.props.style.display = 'flex'
    if (!node.props?.class?.includes('flex-'))
      node.props.style.flexDirection = 'column'
  },
})
