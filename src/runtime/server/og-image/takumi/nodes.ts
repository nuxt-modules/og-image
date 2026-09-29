import type { ContainerNode, ImageNode, Node, TextNode } from '@takumi-rs/helpers'
import type { OgImageRenderEventContext, VNode } from '../../../types'
import { createVNodes, resolveSvgDimension, SVG_CAMEL_ATTR_VALUES } from '../core/vnodes'

const RE_RELATIVE_UNIT = /^[\d.]+r?em$/

const RE_LEADING_SPACE = /^\s/
const RE_TRAILING_SPACE = /\s$/

const RE_UPPERCASE = /[A-Z]/g
const RE_DQUOTE = /"/g
const RE_AMP = /&/g
const RE_LT = /</g
const RE_GT = />/g

export async function createTakumiNodes(ctx: OgImageRenderEventContext): Promise<Node> {
  const vnodeTree = await createVNodes(ctx)
  return await ctx.timings.measure('takumi-nodes', () => vnodeToTakumiNode(vnodeTree))
}

// Extract numeric width/height from HTML attributes
function pickNumericDimension(props: Record<string, any>, key: 'width' | 'height'): number | undefined {
  const v = props[key]
  if (v == null)
    return undefined
  const n = Number(v)
  return Number.isNaN(n) ? undefined : n
}

function extractColor(style: Record<string, any> | undefined): string | undefined {
  const color = style?.color
  return typeof color === 'string' && color ? color : undefined
}

export async function vnodeToTakumiNode(vnode: VNode, inheritedColor?: string): Promise<Node> {
  const { style, children, class: cls, tw, src, ...rest } = vnode.props
  const nodeColor = extractColor(style) ?? inheritedColor

  const baseMetadata = {
    tw: tw || cls || undefined,
    style,
  }

  // SVG elements → convert to SVG string
  if (vnode.type === 'svg') {
    // em sizes follow the text the SVG sits in, as with emoji. Takumi resolves em against
    // the computed font size, which includes Tailwind classes this converter cannot see.
    const relativeW = RE_RELATIVE_UNIT.test(String(rest.width ?? '')) ? String(rest.width) : undefined
    const relativeH = RE_RELATIVE_UNIT.test(String(rest.height ?? '')) ? String(rest.height) : undefined
    const imageStyle = relativeW || relativeH
      ? { ...style, ...(relativeW && style?.width == null ? { width: relativeW } : {}), ...(relativeH && style?.height == null ? { height: relativeH } : {}) }
      : style
    return {
      ...baseMetadata,
      style: imageStyle,
      type: 'image',
      src: vnodeToHtmlString(vnode, nodeColor),
      width: relativeW ? undefined : resolveSvgDimension(rest, style, 'width'),
      height: relativeH ? undefined : resolveSvgDimension(rest, style, 'height'),
    } satisfies ImageNode
  }

  if (vnode.type === 'img') {
    return {
      ...baseMetadata,
      type: 'image',
      src: src || rest.href || '',
      width: pickNumericDimension(rest, 'width'),
      height: pickNumericDimension(rest, 'height'),
    } satisfies ImageNode
  }

  // For non-image nodes, merge any explicit width/height into style
  const containerStyle = { ...style }
  const w = pickNumericDimension(rest, 'width')
  const h = pickNumericDimension(rest, 'height')
  if (w != null && !containerStyle.width)
    containerStyle.width = w
  if (h != null && !containerStyle.height)
    containerStyle.height = h
  const hasStyle = Object.keys(containerStyle).length > 0
  const containerMetadata = {
    tw: baseMetadata.tw,
    style: hasStyle ? containerStyle : undefined,
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
      ...containerMetadata,
      type: 'text',
      text: textContent,
    } satisfies TextNode
  }

  // Array children
  if (Array.isArray(children)) {
    const takumiChildren: Node[] = []
    const isInlineImage = (c: unknown) => !!c && typeof c === 'object' && ['svg', 'img'].includes((c as VNode).type)
    for (const [i, child] of children.entries()) {
      if (child && typeof child === 'object') {
        takumiChildren.push(await vnodeToTakumiNode(child, nodeColor))
      }
      else if (typeof child === 'string' && child.trim()) {
        // Keep one space next to an inline image such as an emoji, so "it 🚀 now" keeps its gaps
        const start = isInlineImage(children[i - 1]) && RE_LEADING_SPACE.test(child) ? ' ' : ''
        const end = isInlineImage(children[i + 1]) && RE_TRAILING_SPACE.test(child) ? ' ' : ''
        takumiChildren.push({ type: 'text', text: `${start}${child.trim()}${end}` })
      }
    }

    return {
      ...containerMetadata,
      type: 'container',
      children: takumiChildren.length ? takumiChildren : undefined,
    } satisfies ContainerNode
  }

  // No children
  return {
    ...containerMetadata,
    type: 'container',
  } satisfies ContainerNode
}

function resolveCurrentColor(value: any, color: string | undefined): any {
  return color && typeof value === 'string' && value.toLowerCase() === 'currentcolor'
    ? color
    : value
}

function vnodeToHtmlString(vnode: VNode, inheritedColor?: string): string {
  const { style, children, ...attrs } = vnode.props
  const attrParts: string[] = []
  const nodeColor = extractColor(style) ?? inheritedColor

  const kebabCase = (str: string) => str.replace(RE_UPPERCASE, m => `-${m.toLowerCase()}`)

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
      .map(([k, v]) => `${kebabCase(k)}:${resolveValue(resolveCurrentColor(v, nodeColor))}`)
      .join(';')
    if (styleStr)
      attrParts.push(`style="${styleStr.replace(RE_DQUOTE, '&quot;')}"`)
  }
  else if (typeof style === 'string') {
    attrParts.push(`style="${(style as string).replace(RE_DQUOTE, '&quot;')}"`)
  }

  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'tw' || key === 'class' || val == null)
      continue
    // SVG attributes like viewBox, preserveAspectRatio must preserve their casing
    const finalKey = SVG_CAMEL_ATTR_VALUES.has(key) ? key : kebabCase(key)
    attrParts.push(`${finalKey}="${String(resolveValue(resolveCurrentColor(val, nodeColor))).replace(RE_DQUOTE, '&quot;')}"`)
  }

  const open = attrParts.length ? `<${vnode.type} ${attrParts.join(' ')}>` : `<${vnode.type}>`

  const inner = Array.isArray(children)
    ? (children as (VNode | string)[]).map((c) => {
        if (typeof c === 'string')
          return c.replace(RE_AMP, '&amp;').replace(RE_LT, '&lt;').replace(RE_GT, '&gt;')
        if (c && typeof c === 'object')
          return vnodeToHtmlString(c, nodeColor)
        return ''
      }).join('')
    : (typeof children === 'string' ? children.replace(RE_AMP, '&amp;').replace(RE_LT, '&lt;').replace(RE_GT, '&gt;') : '')

  return `${open}${inner}</${vnode.type}>`
}
