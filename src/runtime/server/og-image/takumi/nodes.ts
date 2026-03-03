import type { OgImageRenderEventContext, VNode } from '../../../types'
import { createVNodes, SVG_CAMEL_ATTR_VALUES } from '../core/vnodes'

export interface TakumiNode {
  type: 'container' | 'image' | 'text'
  children?: TakumiNode[]
  text?: string
  src?: string
  style?: Record<string, any>
  tw?: string
  /** Any extra HTML attributes (width, height, alt, etc.) are spread as top-level props */
  [key: string]: any
}

export async function createTakumiNodes(ctx: OgImageRenderEventContext): Promise<TakumiNode> {
  const vnodeTree = await createVNodes(ctx)
  return await vnodeToTakumiNode(vnodeTree)
}

// Attributes that are meaningful to Takumi's layout engine (must be numeric)
function pickDimensions(props: Record<string, any>): Record<string, number> | undefined {
  let out: Record<string, number> | undefined
  for (const key of ['width', 'height'] as const) {
    const v = props[key]
    if (v == null)
      continue
    const n = Number(v)
    if (!Number.isNaN(n)) {
      out ??= {}
      out[key] = n
    }
  }
  return out
}

async function vnodeToTakumiNode(vnode: VNode): Promise<TakumiNode> {
  const { style, children, class: cls, tw, src, ...rest } = vnode.props
  const attrs = pickDimensions(rest)

  const base: TakumiNode = {
    type: 'container',
    tw: tw || cls || undefined,
    style,
    ...attrs,
  }

  // SVG elements → convert to SVG to string
  if (vnode.type === 'svg') {
    return {
      ...base,
      type: 'image',
      src: vnodeToHtmlString(vnode),
    }
  }

  if (vnode.type === 'img') {
    return {
      ...base,
      type: 'image',
      src: src || rest.href || '',
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
      ...base,
      type: 'text',
      text: textContent,
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
      ...base,
      children: takumiChildren.length ? takumiChildren : undefined,
    }
  }

  // No children
  return base
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
