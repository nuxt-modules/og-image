import type { VNode } from '../../../../types'
import { defineSatoriTransformer } from '../utils'

// copy classes to tw classes so they get processed
export default defineSatoriTransformer({
  filter: (node: VNode) => !!node.props?.class && !node.props?.tw,
  transform: async (node: VNode) => {
    node.props.tw = node.props.class
  },
})
