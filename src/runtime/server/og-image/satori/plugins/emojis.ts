import type { OgImageRenderEventContext, VNode } from '../../../../types'
import { getEmojiSvg } from '#og-image/emoji-transform'
import { parseHTML } from 'linkedom'
import { RE_MATCH_EMOJIS } from '../transforms/emojis/emoji-utils'
import { defineSatoriTransformer } from '../utils'

/**
 * Convert kebab-case to camelCase for CSS properties
 */
function camelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

/**
 * Parse inline style attribute into object with camelCased keys
 */
function parseStyleAttr(style: string | null): Record<string, any> | undefined {
  if (!style)
    return undefined
  const result: Record<string, any> = {}
  for (const decl of style.split(';')) {
    const colonIdx = decl.indexOf(':')
    if (colonIdx === -1)
      continue
    const prop = decl.slice(0, colonIdx).trim()
    const val = decl.slice(colonIdx + 1).trim()
    if (prop && val)
      result[camelCase(prop)] = val
  }
  return Object.keys(result).length ? result : undefined
}

/**
 * Convert a linkedom Element to Satori VNode format
 */
function elementToVNode(el: Element): VNode {
  const tagName = el.tagName.toLowerCase()
  const props: VNode['props'] = {}

  const style = parseStyleAttr(el.getAttribute('style'))
  if (style)
    props.style = style

  for (const attr of el.attributes) {
    if (attr.name === 'style')
      continue
    props[attr.name] = attr.value
  }

  const children: (VNode | string)[] = []
  for (const child of el.childNodes) {
    if (child.nodeType === 1) {
      children.push(elementToVNode(child as Element))
    }
    else if (child.nodeType === 3) {
      const text = child.textContent || ''
      if (text.trim())
        children.push(text)
    }
  }

  if (children.length)
    props.children = children

  return { type: tagName, props } as VNode
}

/**
 * Parse SVG string to VNode
 */
function svgToVNode(svg: string): VNode | null {
  const { document } = parseHTML(svg)
  const svgEl = document.querySelector('svg')
  if (!svgEl)
    return null
  return elementToVNode(svgEl)
}

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
      // Reset lastIndex before test() to avoid issues with the global regex flag
      RE_MATCH_EMOJIS.lastIndex = 0
      return RE_MATCH_EMOJIS.test(node.props.children)
    },
    transform: async (node: VNode, ctx: OgImageRenderEventContext) => {
      const text = node.props.children as string

      // Reset lastIndex before matchAll to ensure all matches are found
      RE_MATCH_EMOJIS.lastIndex = 0
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
          // Parse the SVG and convert to Satori VNode
          const svgNode = svgToVNode(svg)
          if (svgNode) {
            // Apply emoji styling - remove unsupported display:inline-block
            svgNode.props['data-emoji'] = true
            const existingStyle = svgNode.props.style || {}
            // Remove display:inline-block as Satori doesn't support it
            if (existingStyle.display === 'inline-block')
              delete existingStyle.display
            svgNode.props.style = {
              ...existingStyle,
              width: '1em',
              height: '1em',
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

      // Update the node's children and ensure display:flex for Satori compatibility
      if (children.length >= 1) {
        // Convert all children to VNodes for consistent handling
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
        // Satori requires explicit display:flex when element has array children
        node.props.style = node.props.style || {}
        node.props.style.display = 'flex'
        node.props.style.alignItems = 'center'
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
      // Satori requires explicit display:flex when element has multiple children
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
