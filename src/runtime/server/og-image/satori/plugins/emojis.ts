import type { OgImageRenderEventContext, VNode } from '../../../../types'
import { getEmojiSvg } from '#og-image/emoji-transform'
import { RE_MATCH_EMOJIS } from '../transforms/emojis'
import { defineSatoriTransformer } from '../utils'

function isEmojiSvg(node: VNode) {
  return node.type === 'svg'
    && typeof node.props?.['data-emoji'] !== 'undefined'
}

function hasEmojiInText(text: string): boolean {
  return RE_MATCH_EMOJIS.test(text)
}

export default defineSatoriTransformer([
  // Transform text nodes that contain emojis to replace them with SVG nodes
  {
    filter: (node: VNode) =>
      typeof node.props?.children === 'string' && hasEmojiInText(node.props.children),
    transform: async (node: VNode, ctx: OgImageRenderEventContext) => {
      const text = node.props.children as string

      // Find all emojis in the text
      const matches = text.match(RE_MATCH_EMOJIS)
      if (!matches?.length)
        return

      const children: (VNode | string)[] = []
      let lastIndex = 0

      // Process each emoji match
      for (const match of matches) {
        const emojiIndex = text.indexOf(match, lastIndex)

        // Add text before the emoji
        if (emojiIndex > lastIndex) {
          const beforeText = text.slice(lastIndex, emojiIndex)
          if (beforeText)
            children.push(beforeText)
        }

        // Try to get SVG for the emoji
        const svg = await getEmojiSvg(ctx, match)
        if (svg) {
          // Parse the SVG string into a VNode
          // Basic SVG parsing - this could be enhanced with a proper parser
          const svgMatch = svg.match(/<svg([^>]*)>(.*)<\/svg>/s)
          if (svgMatch) {
            const [, attributes, body] = svgMatch

            // Parse attributes
            const props: Record<string, any> = { 'data-emoji': true }
            const attrRegex = /(\w+)="([^"]*)"/g
            let attrMatch
            // eslint-disable-next-line no-cond-assign
            while ((attrMatch = attrRegex.exec(attributes))) {
              const [, name, value] = attrMatch
              props[name] = value
            }

            // Add our styling
            props.style = {
              margin: '0 .05em 0 .15em',
              verticalAlign: '-0.1em',
              ...props.style,
            }

            children.push({
              type: 'svg',
              props: {
                ...props,
                children: body,
              },
            })
          }
        }
        else {
          // If we can't get the SVG, keep the original emoji
          children.push(match)
        }

        lastIndex = emojiIndex + match.length
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
        // Ensure the parent has proper display styles for mixed content
        node.props.style = node.props.style || {}
        if (!node.props.style.display) {
          node.props.style.display = 'flex'
          node.props.style.alignItems = 'center'
        }
      }
    },
  },
  // Keep the existing logic for styling containers with emoji SVGs
  {
    filter: (node: VNode) =>
      ['div', 'p'].includes(node.type) && Array.isArray(node.props?.children) && (node.props.children as VNode[]).some(isEmojiSvg),
    transform: (node: VNode) => {
      node.props.style = node.props.style || {}
      node.props.style.display = 'flex'
      node.props.style.alignItems = 'center'
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
