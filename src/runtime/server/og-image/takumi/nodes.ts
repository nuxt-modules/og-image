import type { OgImageRenderEventContext, VNode } from '../../../types'
import { createVNodes, SVG_CAMEL_ATTR_VALUES } from '../core/vnodes'
import { resolveUnsupportedUnits, stripGradientColorSpace } from '../utils/css'

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
  const vnodeTree = await createVNodes(ctx)
  return await vnodeToTakumiNode(vnodeTree, Number(ctx.options.width), Number(ctx.options.height))
}

async function vnodeToTakumiNode(vnode: VNode, parentWidth?: number, parentHeight?: number, inheritedColor?: string): Promise<TakumiNode> {
  let { style, children, class: cls, tw, src, width, height, ...rest } = vnode.props

  if (style && typeof style === 'object') {
    style = Object.fromEntries(
      Object.entries(style)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, typeof v === 'string' ? resolveUnsupportedUnits(v, parentWidth, parentHeight) : v]),
    )
    // Takumi expects lineClamp as a number, but HTML/CSS parsing yields a string
    if (style.lineClamp != null)
      style.lineClamp = Number(style.lineClamp)
    if (Object.keys(style).length === 0)
      style = undefined
  }

  // Helper to resolve units to pixels
  const resolvePx = (val: any, total?: number) => {
    if (typeof val === 'string') {
      if (val.includes('calc('))
        return undefined
      const num = Number.parseFloat(val)
      if (Number.isNaN(num))
        return undefined
      if (val.endsWith('%') && total)
        return (num / 100) * total
      if (val.endsWith('em') || val.endsWith('rem'))
        return num * 16
      return num
    }
    if (typeof val === 'number')
      return val
    return undefined
  }

  // Dimension fallback logic
  const resolvedWidth = resolvePx(width, parentWidth) || resolvePx(style?.width, parentWidth) || extractTwDim(tw || cls, 'w', parentWidth)
  const resolvedHeight = resolvePx(height, parentHeight) || resolvePx(style?.height, parentHeight) || extractTwDim(tw || cls, 'h', parentHeight)

  // Resolve color for currentColor inheritance (CSS color cascades to children)
  const nodeColor = style?.color || inheritedColor

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
    let svg = vnodeToHtmlString({ ...vnode, props: svgProps })

    // Resolve currentColor before base64 encoding — images lose CSS inheritance context
    if (nodeColor && svg.includes('currentColor'))
      svg = svg.replaceAll('currentColor', nodeColor)

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

  // Pure text content → emit a text node with style applied directly.
  // Takumi's fromJsx collapses text-only elements into text nodes; properties
  // like lineClamp / textOverflow only work when set on the text node itself.
  const textContent = typeof children === 'string'
    ? children
    : (Array.isArray(children) && children.length >= 1 && children.every(c => typeof c === 'string'))
        ? (children as string[]).join('')
        : undefined

  if (textContent !== undefined) {
    return {
      type: 'text',
      text: textContent,
      width: resolvedWidth,
      height: resolvedHeight,
      tw: tw || cls || undefined,
      style,
    }
  }

  // Array children
  if (Array.isArray(children)) {
    const takumiChildren: TakumiNode[] = []
    for (const child of children) {
      if (child && typeof child === 'object')
        takumiChildren.push(await vnodeToTakumiNode(child, resolvedWidth, resolvedHeight, nodeColor))
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
  if (!twCls || twCls.includes('calc('))
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

  const stripColorSpace = (val: any) => typeof val === 'string' ? stripGradientColorSpace(val) : val

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
    if (typeof val === 'string') {
      if (val.includes('calc('))
        return val
      if (val.endsWith('em') || val.endsWith('rem')) {
        const num = Number.parseFloat(val)
        return !Number.isNaN(num) ? `${num * 16}px` : val
      }
    }
    return val
  }

  // Serialize style back to string
  if (style && typeof style === 'object') {
    const styleStr = Object.entries(style)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${kebabCase(k)}:${stripColorSpace(resolveValue(v))}`)
      .join(';')
    if (styleStr)
      attrParts.push(`style="${styleStr.replace(/"/g, '&quot;')}"`)
  }
  else if (typeof style === 'string') {
    attrParts.push(`style="${stripColorSpace(style as string).replace(/"/g, '&quot;')}"`)
  }

  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'tw' || key === 'class' || val == null)
      continue
    // SVG attributes like viewBox, preserveAspectRatio must preserve their casing
    const finalKey = SVG_CAMEL_ATTR_VALUES.has(key) ? key : kebabCase(key)
    attrParts.push(`${finalKey}="${String(resolveValue(val)).replace(/"/g, '&quot;')}"`)
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
