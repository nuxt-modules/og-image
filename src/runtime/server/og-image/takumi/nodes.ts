import type { OgImageRenderEventContext, VNode } from '../../../types'
import { htmlDecodeQuotes } from '../../util/encoding'
import { fetchIsland } from '../../util/kit'
import encoding from '../satori/plugins/encoding'
import twClasses from '../satori/plugins/twClasses'
import { applyEmojis } from '../satori/transforms/emojis'
import { applyInlineCss } from '../satori/transforms/inlineCss'
import { walkSatoriTree } from '../satori/utils'
import { htmlToVNode } from '../satori/vnodes'

export interface TakumiNode {
  type: 'container' | 'image' | 'text'
  children?: TakumiNode[]
  text?: string
  src?: string
  width?: number
  height?: number
  style?: Record<string, any>
  tw?: string
}

export async function createTakumiNodes(ctx: OgImageRenderEventContext): Promise<TakumiNode> {
  let html = ctx.options.html
  if (!html) {
    const island = await fetchIsland(ctx.e, ctx.options.component!, typeof ctx.options.props !== 'undefined' ? ctx.options.props as Record<string, any> : ctx.options)
    island.html = htmlDecodeQuotes(island.html)
    await applyInlineCss(ctx, island)
    await applyEmojis(ctx, island)
    html = island.html
    if (html?.includes('<body>'))
      html = html.match(/<body>([\s\S]*)<\/body>/)?.[1] || ''
  }

  const template = `<div style="position: relative; display: flex; margin: 0 auto; width: ${ctx.options.width}px; height: ${ctx.options.height}px; overflow: hidden;">${html}</div>`

  // Parse to VNode tree and apply shared plugins (encoding + twClasses for dark:/responsive)
  const vnodeTree = htmlToVNode(template)
  walkSatoriTree(ctx, vnodeTree, [encoding, twClasses])

  return vnodeToTakumiNode(vnodeTree)
}

function vnodeToTakumiNode(vnode: VNode): TakumiNode {
  const { style, children, class: cls, tw, src, width, height, ...rest } = vnode.props

  // SVG elements → base64 data URI image
  if (vnode.type === 'svg') {
    return {
      type: 'image',
      src: vnodeToSvgDataUri(vnode),
      width: Number(width) || undefined,
      height: Number(height) || undefined,
    }
  }

  if (vnode.type === 'img') {
    return {
      type: 'image',
      src: src || rest.href || '',
      width: Number(width) || undefined,
      height: Number(height) || undefined,
      tw: tw || cls || undefined,
      style,
    }
  }

  // Single text child → text node
  if (typeof children === 'string') {
    return {
      type: 'text',
      text: children,
      tw: tw || cls || undefined,
      style,
    }
  }

  // Array children
  if (Array.isArray(children)) {
    // If only one child and it's a string → text node
    if (children.length === 1 && typeof children[0] === 'string') {
      return {
        type: 'text',
        text: children[0],
        tw: tw || cls || undefined,
        style,
      }
    }

    const takumiChildren: TakumiNode[] = []
    for (const child of children) {
      if (child && typeof child === 'object')
        takumiChildren.push(vnodeToTakumiNode(child))
      else if (typeof child === 'string' && child.trim())
        takumiChildren.push({ type: 'text', text: child.trim() })
    }

    return {
      type: 'container',
      children: takumiChildren.length ? takumiChildren : undefined,
      tw: tw || cls || undefined,
      style,
    }
  }

  // No children
  return {
    type: 'container',
    tw: tw || cls || undefined,
    style,
  }
}

function vnodeToSvgDataUri(vnode: VNode): string {
  const svg = vnodeToHtmlString(vnode)
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function vnodeToHtmlString(vnode: VNode): string {
  const { style, children, ...attrs } = vnode.props
  const attrParts: string[] = []

  // Serialize style back to string
  if (style && typeof style === 'object') {
    const styleStr = Object.entries(style)
      .map(([k, v]) => `${k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}:${v}`)
      .join(';')
    if (styleStr)
      attrParts.push(`style="${styleStr}"`)
  }
  else if (typeof style === 'string') {
    attrParts.push(`style="${style}"`)
  }

  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'tw' || key === 'class' || val == null)
      continue
    attrParts.push(`${key}="${String(val)}"`)
  }

  const open = attrParts.length ? `<${vnode.type} ${attrParts.join(' ')}>` : `<${vnode.type}>`

  if (!children)
    return `${open}</${vnode.type}>`

  if (typeof children === 'string')
    return `${open}${children}</${vnode.type}>`

  if (Array.isArray(children)) {
    const inner = children.map((c) => {
      if (typeof c === 'string')
        return c
      if (c && typeof c === 'object')
        return vnodeToHtmlString(c)
      return ''
    }).join('')
    return `${open}${inner}</${vnode.type}>`
  }

  return `${open}</${vnode.type}>`
}
