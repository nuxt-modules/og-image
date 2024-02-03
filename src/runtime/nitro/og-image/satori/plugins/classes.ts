import type { VNode } from '../../../../types'
import { defineSatoriTransformer } from '../utils'

// copy classes to tw classes so they get processed
export default defineSatoriTransformer([
  {
    filter: (node: VNode) => !!node.props?.class && !node.props?.tw,
    transform: async (node: VNode) => {
      node.props.tw = node.props.class
      // we should remove classes we know that satori will complain about such as `icon` and `inline-style`
      node.props.tw = node.props.tw.replace(/icon|inline-style/g, '')
    },
  },
  {
    filter: (node: VNode) => !!node.props?.style?.display,
    transform: async (node: VNode) => {
      if (['inline-block', 'inline'].includes(node.props.style!.display)) {
        delete node.props.style!.display
      }
    },
  },
])
