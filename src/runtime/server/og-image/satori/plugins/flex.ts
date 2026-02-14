import type { VNode } from '../../../../types'
import { defineTransformer } from '../../core/plugins'

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

// Add missing flex defaults for Satori compatibility.
// Build-time handles elements with classes (emitting display:flex + flex-direction:row).
// This plugin only handles bare elements the build-time transform didn't touch.
export default defineTransformer({
  filter: (node: VNode) =>
    [...INLINE_ELEMENTS, 'div'].includes(node.type)
    && (Array.isArray(node.props?.children) && node.props?.children.length >= 1)
    && (!node.props?.class?.includes('hidden')),
  transform: (node: VNode) => {
    node.props.style = node.props.style || {}
    // Skip if display is already set (build-time handled it)
    if (node.props.style.display) {
      return
    }
    if (node.type === 'div') {
      node.props.style.display = 'flex'
      // If class contains `flex`, user explicitly wants flex (default = row).
      // Satori's tw prop handles flex-col/flex-row from the class.
      // Only auto-column for bare divs without any flex class.
      if (!node.props.style.flexDirection && !/\bflex\b/.test(node.props?.class || '')) {
        node.props.style.flexDirection = 'column'
      }
      return
    }
    // Inline elements get flex + wrap defaults
    node.props.style.display = 'flex'
    if (!node.props.style.flexWrap) {
      node.props.style.flexWrap = 'wrap'
    }
    if (node.props.style.flexWrap === 'wrap' && !node.props.style.gap) {
      node.props.style.gap = '0.2em'
    }
  },
})
