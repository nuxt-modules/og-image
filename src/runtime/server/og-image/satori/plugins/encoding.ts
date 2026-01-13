import type { VNode } from '../../../../types'
import { decodeHtml } from '../../../util/encoding'
import { defineSatoriTransformer } from '../utils'

export default defineSatoriTransformer([
  // clean up vue inspector data attributes
  {
    filter: (node: VNode) => node.props?.['data-v-inspector'],
    transform: (node: VNode) => {
      delete node.props['data-v-inspector']
    },
  },
  // decode HTML entities in string children
  {
    filter: (node: VNode) => typeof node.props?.children === 'string',
    transform: (node: VNode) => {
      node.props.children = decodeHtml(node.props.children as string)
    },
  },
  // decode HTML entities in array children (text nodes with siblings)
  {
    filter: (node: VNode) => Array.isArray(node.props?.children),
    transform: (node: VNode) => {
      // @ts-expect-error untyped
      node.props.children = (node.props.children as (string | VNode)[]).map(
        child => typeof child === 'string' ? decodeHtml(child) : child,
      )
    },
  },
])
