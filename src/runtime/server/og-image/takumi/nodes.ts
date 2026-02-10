import type { OgImageRenderEventContext, VNode } from '../../../types'
import { htmlDecodeQuotes } from '../../util/encoding'
import { fetchIsland } from '../../util/kit'
import encoding from '../satori/plugins/encoding'
import imageSrc from '../satori/plugins/imageSrc'
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
  await Promise.all(walkSatoriTree(ctx, vnodeTree, [encoding, twClasses, imageSrc]))

  return await vnodeToTakumiNode(vnodeTree, Number(ctx.options.width), Number(ctx.options.height))
}

async function vnodeToTakumiNode(vnode: VNode, parentWidth?: number, parentHeight?: number): Promise<TakumiNode> {
  const { style, children, class: cls, tw, src, width, height, ...rest } = vnode.props

  // Helper to resolve units to pixels
  const resolvePx = (val: any, total?: number) => {
    if (typeof val === 'string' && val.endsWith('%') && total) {
      return (Number.parseFloat(val) / 100) * total
    }
    if (typeof val === 'string' && (val.endsWith('em') || val.endsWith('rem'))) {
      const num = Number.parseFloat(val)
      return !Number.isNaN(num) ? num * 16 : undefined
    }
    if (typeof val === 'string' && val.endsWith('px')) {
      return Number.parseFloat(val) || undefined
    }
    if (typeof val === 'number')
      return val
    return undefined
  }

  // Dimension fallback logic
  const resolvedWidth = resolvePx(width, parentWidth) || resolvePx(style?.width, parentWidth) || extractTwDim(tw || cls, 'w', parentWidth)
  const resolvedHeight = resolvePx(height, parentHeight) || resolvePx(style?.height, parentHeight) || extractTwDim(tw || cls, 'h', parentHeight)

  // SVG elements → convert to SVG data URI for takumi to handle
  if (vnode.type === 'svg') {
    let finalWidth = resolvedWidth
    let finalHeight = resolvedHeight

    // Parse viewBox for missing dimensions
    if ((!finalWidth || !finalHeight) && typeof rest.viewBox === 'string') {
      const parts = rest.viewBox.split(/[ ,]+/).map(Number)
      if (parts.length === 4 && !parts.some(Number.isNaN)) {
        const vbWidth = parts[2]!
        const vbHeight = parts[3]!
        if (!finalWidth && !finalHeight) {
          finalWidth = vbWidth
          finalHeight = vbHeight
        }
        else if (finalWidth) {
          finalHeight = Math.round(finalWidth * (vbHeight / vbWidth))
        }
        else if (finalHeight) {
          finalWidth = Math.round(finalHeight * (vbWidth / vbHeight))
        }
      }
    }

    if (finalWidth && !finalHeight)
      finalHeight = finalWidth
    else if (finalHeight && !finalWidth)
      finalWidth = finalHeight

    const renderWidth = finalWidth || 100
    const renderHeight = finalHeight || 100

    const svgProps = { ...vnode.props }
    svgProps.width = renderWidth
    svgProps.height = renderHeight
    const svg = vnodeToHtmlString({ ...vnode, props: svgProps })

    return {
      type: 'image',
      src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      width: renderWidth,
      height: renderHeight,
      tw: tw || cls || undefined,
      style,
    }
  }

  if (vnode.type === 'img') {
    let finalWidth = resolvedWidth
    let finalHeight = resolvedHeight

    if (finalWidth && !finalHeight)
      finalHeight = finalWidth
    else if (finalHeight && !finalWidth)
      finalWidth = finalHeight

    return {
      type: 'image',
      src: src || rest.href || '',
      width: finalWidth,
      height: finalHeight,
      tw: tw || cls || undefined,
      style,
    }
  }

  // Single text child → container with text child
  if (typeof children === 'string') {
    return {
      type: 'container',
      children: [{ type: 'text', text: children }],
      width: resolvedWidth,
      height: resolvedHeight,
      tw: tw || cls || undefined,
      style,
    }
  }

  // Array children
  if (Array.isArray(children)) {
    // If only one child and it's a string → container with text child
    if (children.length === 1 && typeof children[0] === 'string') {
      return {
        type: 'container',
        children: [{ type: 'text', text: children[0] }],
        width: resolvedWidth,
        height: resolvedHeight,
        tw: tw || cls || undefined,
        style,
      }
    }

    const takumiChildren: TakumiNode[] = []
    for (const child of children) {
      if (child && typeof child === 'object')
        takumiChildren.push(await vnodeToTakumiNode(child, resolvedWidth, resolvedHeight))
      else if (typeof child === 'string' && child.trim())
        takumiChildren.push({ type: 'text', text: child.trim() })
    }

    return {
      type: 'container',
      children: takumiChildren.length ? takumiChildren : undefined,
      width: resolvedWidth,
      height: resolvedHeight,
      tw: tw || cls || undefined,
      style,
    }
  }

  // No children
  return {
    type: 'container',
    width: resolvedWidth,
    height: resolvedHeight,
    tw: tw || cls || undefined,
    style,
  }
}

// Extract dimensions from tailwind classes (enhanced support)
function extractTwDim(twCls: string | undefined, prefix: string, total?: number): number | undefined {
  if (!twCls)
    return undefined

  // Match arbitrary value classes (w-[31.5%], h-[48%], w-[100px])
  const arbMatch = twCls.match(new RegExp(`\\b${prefix}-\\[([^\\]]+)\\]\\b`))
  if (arbMatch?.[1]) {
    const val = arbMatch[1]
    if (val.endsWith('%') && total)
      return (Number.parseFloat(val) / 100) * total
    if (val.endsWith('px'))
      return Number.parseFloat(val)
    if (!Number.isNaN(Number(val)))
      return Number(val)
  }

  // Match basic numeric classes (w-32, h-64)
  const numMatch = twCls.match(new RegExp(`\\b${prefix}-(\\d+)\\b`))
  if (numMatch?.[1])
    return Number.parseInt(numMatch[1]) * 4

  // Match fraction classes (w-1/3, w-full, h-screen)
  if (total) {
    if (twCls.includes(`${prefix}-full`))
      return total
    if (twCls.includes(`${prefix}-1/2`))
      return total * 0.5
    if (twCls.includes(`${prefix}-1/3`))
      return total * (1 / 3)
    if (twCls.includes(`${prefix}-2/3`))
      return total * (2 / 3)
    if (twCls.includes(`${prefix}-1/4`))
      return total * 0.25
    if (twCls.includes(`${prefix}-3/4`))
      return total * 0.75
  }
  return undefined
}

function vnodeToHtmlString(vnode: VNode): string {
  const { style, children, ...attrs } = vnode.props
  const attrParts: string[] = []

  const kebabCase = (str: string) => str.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)

  if (vnode.type === 'svg') {
    if (!attrs.xmlns)
      attrParts.push('xmlns="http://www.w3.org/2000/svg"')
    if (!attrs.width && vnode.props.width)
      attrParts.push(`width="${vnode.props.width}"`)
    if (!attrs.height && vnode.props.height)
      attrParts.push(`height="${vnode.props.height}"`)
  }

  // Helper to resolve units to pixels
  const resolveValue = (val: any) => {
    if (typeof val === 'string' && (val.endsWith('em') || val.endsWith('rem'))) {
      const num = Number.parseFloat(val)
      return !Number.isNaN(num) ? `${num * 16}px` : val
    }
    return val
  }

  // Serialize style back to string
  if (style && typeof style === 'object') {
    const styleStr = Object.entries(style)
      .map(([k, v]) => `${kebabCase(k)}:${resolveValue(v)}`)
      .join(';')
    if (styleStr)
      attrParts.push(`style="${styleStr.replace(/"/g, '&quot;')}"`)
  }
  else if (typeof style === 'string') {
    attrParts.push(`style="${(style as string).replace(/"/g, '&quot;')}"`)
  }

  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'tw' || key === 'class' || val == null)
      continue
    attrParts.push(`${kebabCase(key)}="${String(resolveValue(val)).replace(/"/g, '&quot;')}"`)
  }

  const open = attrParts.length ? `<${vnode.type} ${attrParts.join(' ')}>` : `<${vnode.type}>`

  const inner = Array.isArray(children)
    ? (children as (VNode | string)[]).map((c) => {
        if (typeof c === 'string')
          return c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        if (c && typeof c === 'object')
          return vnodeToHtmlString(c)
        return ''
      }).join('')
    : (typeof children === 'string' ? children.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '')

  return `${open}${inner}</${vnode.type}>`
}
