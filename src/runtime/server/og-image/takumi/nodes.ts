import type { OgImageRenderEventContext, VNode } from '../../../types'
import { createVNodes, SVG_CAMEL_ATTR_VALUES } from '../core/vnodes'

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
  return await vnodeToTakumiNode(vnodeTree)
}

async function vnodeToTakumiNode(vnode: VNode): Promise<TakumiNode> {
  let { style, children, class: cls, tw, src, width, height, ...rest } = vnode.props

  // SVG elements → convert to SVG to string
  if (vnode.type === 'svg') {
    const src = vnodeToHtmlString(vnode)

    return {
      type: 'image',
      src,
      tw: tw || cls || undefined,
      style,
    }
  }

  if (vnode.type === 'img') {
    return {
      type: 'image',
      src: src || rest.href || '',
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
      tw: tw || cls || undefined,
      style,
    }
  }

  // Array children
  if (Array.isArray(children)) {
    const takumiChildren: TakumiNode[] = []
    for (const child of children) {
      if (child && typeof child === 'object')
        takumiChildren.push(await vnodeToTakumiNode(child))
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
