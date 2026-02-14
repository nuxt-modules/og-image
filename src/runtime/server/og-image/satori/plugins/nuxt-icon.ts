import type { VNode } from '../../../../types'
import { logger } from '../../../util/logger'
import { defineTransformer } from '../../core/plugins'

export default defineTransformer([
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
    transform: (node: VNode) => {
      // strip classes
      node.props.class = String(node.props.class)
        .split(' ')
        .filter(c => !c.startsWith('iconify'))
        .join(' ')
    },
  },
])
