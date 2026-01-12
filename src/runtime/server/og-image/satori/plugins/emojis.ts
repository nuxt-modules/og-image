import type { OgImageRenderEventContext, VNode } from '../../../../types'
// @ts-expect-error virtual module alias set in module.ts
import { getEmojiSvg } from '#og-image/emoji-transform'
import { html as convertHtmlToSatori } from 'satori-html'
import { RE_MATCH_EMOJIS } from '../transforms/emojis/emoji-utils'
import { defineSatoriTransformer } from '../utils'

function isEmojiSvg(node: VNode) {
  return node.type === 'svg'
    && typeof node.props?.['data-emoji'] !== 'undefined'
}

export default defineSatoriTransformer([
  // Transform text nodes that contain emojis to replace them with SVG nodes
  {
    filter: (node: VNode) => {
      if (typeof node.props?.children !== 'string')
        return false
      return RE_MATCH_EMOJIS.test(node.props.children)
    },
    transform: async (node: VNode, ctx: OgImageRenderEventContext) => {
      const text = node.props.children as string

      // Use matchAll to get matches with indices for proper handling of repeated emojis
      const matches = [...text.matchAll(RE_MATCH_EMOJIS)]
      if (!matches.length)
        return

      const children: (VNode | string)[] = []
      let lastIndex = 0

      // Process each emoji match with its index
      for (const match of matches) {
        const emoji = match[0]
        const emojiIndex = match.index!

        // Add text before the emoji
        if (emojiIndex > lastIndex) {
          const beforeText = text.slice(lastIndex, emojiIndex)
          if (beforeText)
            children.push(beforeText)
        }

        // Try to get SVG for the emoji
        const svg = await getEmojiSvg(ctx, emoji)
        if (svg) {
          // Parse the SVG and convert to Satori VNode instead of using img element
          const parsedNode = convertHtmlToSatori(svg)
          const nodeChildren = parsedNode?.props?.children as VNode[] | undefined
          if (nodeChildren?.[0]) {
            const svgNode = nodeChildren[0] as VNode
            // Apply emoji styling
            if (svgNode.props) {
              svgNode.props['data-emoji'] = true
              svgNode.props.style = {
                ...svgNode.props.style,
                width: '1em',
                height: '1em',
              }
            }
            children.push(svgNode)
          }
          else {
            // Fallback to original emoji if parsing fails
            children.push(emoji)
          }
        }
        else {
          // If we can't get the SVG, keep the original emoji
          children.push(emoji)
        }

        lastIndex = emojiIndex + emoji.length
      }

      // Add any remaining text after the last emoji
      if (lastIndex < text.length) {
        const afterText = text.slice(lastIndex)
        if (afterText)
          children.push(afterText)
      }

      // Update the node to have multiple children instead of a single text string
      if (children.length > 1) {
        // Convert all children to VNodes (wrap strings in divs)
        const vnodeChildren: VNode[] = children.map((child) => {
          if (typeof child === 'string') {
            return {
              type: 'div',
              props: {
                children: child,
              },
            } as VNode
          }
          return child
        })

        node.props.children = vnodeChildren
      }
    },
  },
  // Keep the existing logic for styling containers with emoji SVGs
  {
    filter: (node: VNode) =>
      ['div', 'p'].includes(node.type) && Array.isArray(node.props?.children) && (node.props.children as VNode[]).some(child =>
        (child.type === 'svg' && child.props?.['data-emoji']) || isEmojiSvg(child),
      ),
    transform: (node: VNode) => {
      node.props.style = node.props.style || {}
      // check if any children nodes are just strings, wrap in a div
      node.props.children = (node.props.children as VNode[]).map((child) => {
        if (typeof child === 'string') {
          return {
            type: 'div',
            props: {
              children: child,
            },
          }
        }
        if (child.props?.class?.includes('emoji'))
          delete child.props.class
        return child
      })
    },
  },
])
