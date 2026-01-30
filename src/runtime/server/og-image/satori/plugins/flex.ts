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

const INLINE_ELEMENTS = [
  'span',
  'a',
  'b',
  'i',
  'u',
  'em',
  'strong',
  'code',
  'abbr',
  'del',
  'ins',
  'mark',
  'sub',
  'sup',
  'small',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
]

// automatically add missing flex rules
export default defineSatoriTransformer({
  filter: (node: VNode) =>
    [...INLINE_ELEMENTS, 'div'].includes(node.type)
    && (Array.isArray(node.props?.children) && node.props?.children.length >= 1)
    && (!node.props?.class?.includes('hidden')),
  transform: (node: VNode) => {
    node.props.style = node.props.style || {}
    if (node.props.style?.display && node.props.style?.display !== 'flex') {
      return
    }
    if (node.type === 'div') {
      node.props.style.display = 'flex'
      // if any of the children are divs we swap it to old behavior
      if (!node.props?.class?.includes('flex-') && Array.isArray(node.props.children) && node.props.children.some(child => typeof child === 'object' && child && BLOCK_ELEMENTS.includes(child.type))) {
        node.props.style.flexDirection = 'column'
        return
      }
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
