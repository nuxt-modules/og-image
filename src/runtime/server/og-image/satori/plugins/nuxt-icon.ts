import type { VNode } from '../../../../types'
import { logger } from '../../../util/logger'
import { defineSatoriTransformer } from '../utils'

export default defineSatoriTransformer([
  // need to make sure parent div has flex for the emoji to render inline
  {
    filter: (node: VNode) =>
      node.type === 'span' && node.props?.class?.includes('iconify'),
    transform: (node: VNode, e) => {
      if (import.meta.dev) {
        logger.warn(`When using the Nuxt Icon components in \`${e.options.component}\` you must provide \`mode="svg"\` to ensure correct rendering.`)
      }
    },
  },
  // need to make sure parent div has flex for the emoji to render inline
  {
    filter: (node: VNode) =>
      node.type === 'svg' && node.props?.class?.includes('iconify'),
    transform: (node: VNode, e) => {
      // strip classes
      node.props.class = node.props.class
        .split(' ')
        .filter(c => !c.startsWith('iconify'))
        .join(' ')
    },
  },
])
