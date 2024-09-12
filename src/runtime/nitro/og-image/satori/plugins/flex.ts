import type { VNode } from '../../../../types'
import { defineSatoriTransformer } from '../utils'

const BLOCK_ELEMENTS = [
  'div',
  'p',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'hr',
  'table',
  'dl',
]

// automatically add missing flex rules
export default defineSatoriTransformer({
  filter: (node: VNode) =>
    node.type === 'div'
    && (Array.isArray(node.props?.children) && node.props?.children.length >= 1)
    && (!node.props?.class?.includes('hidden')),
  transform: (node: VNode) => {
    node.props.style = node.props.style || {}
    if (node.props.style?.display && node.props.style?.display !== 'flex') {
      return
    }
    node.props.style.display = 'flex'
    // if any of the children are divs we swap it to old behavior
    if (!node.props?.class?.includes('flex-') && node.props.children!.some((child: VNode) => BLOCK_ELEMENTS.includes(child.type))) {
      node.props.style.flexDirection = 'column'
      return
    }
    // inline elements
    let flexWrap = node.props?.class?.includes('flex-wrap')
    if (!node.props?.class?.includes('flex-')) {
      node.props.style.flexWrap = 'wrap'
      flexWrap = true
    }
    if (flexWrap && !node.props?.class?.includes('gap')) {
      node.props.style.gap = '0.2em' // 4px for 16px font
    }
  },
})
