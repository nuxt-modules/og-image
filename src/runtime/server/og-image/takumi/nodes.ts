import type { ContainerNode, ImageNode, Node, TextNode } from '@takumi-rs/core'
import type { OgImageRenderEventContext, VNode } from '../../../types'
import { createVNodes, resolveSvgDimension, SVG_CAMEL_ATTR_VALUES } from '../core/vnodes'

const RE_RELATIVE_UNIT = /^([\d.]+)(em|rem)$/
const RE_TW_TEXT_ARBITRARY = /(?:^|\s)text-\[(\d+(?:\.\d+)?)(px|rem|em)\]/
const RE_FONT_SIZE_PX = /^(\d+(?:\.\d+)?)(px)?$/

const DEFAULT_FONT_SIZE = 16

const RE_UPPERCASE = /[A-Z]/g
const RE_DQUOTE = /"/g
const RE_AMP = /&/g
const RE_LT = /</g
const RE_GT = />/g

export async function createTakumiNodes(ctx: OgImageRenderEventContext): Promise<Node> {
  const vnodeTree = await createVNodes(ctx)
  return await ctx.timings.measure('takumi-nodes', () => vnodeToTakumiNode(vnodeTree, DEFAULT_FONT_SIZE))
}

// Extract numeric width/height from HTML attributes
function pickNumericDimension(props: Record<string, any>, key: 'width' | 'height'): number | undefined {
  const v = props[key]
  if (v == null)
    return undefined
  const n = Number(v)
  return Number.isNaN(n) ? undefined : n
}

/**
 * Resolve an em/rem value to pixels given the inherited font size.
 */
function resolveRelativeUnit(value: string | number | undefined, inheritedFontSize: number): number | undefined {
  if (value == null)
    return undefined
  const match = String(value).match(RE_RELATIVE_UNIT)
  if (!match)
    return undefined
  const n = Number.parseFloat(match[1]!)
  return match[2] === 'rem' ? n * DEFAULT_FONT_SIZE : n * inheritedFontSize
}

/**
 * Extract font size in px from a vnode's style or tailwind classes.
 */
function extractFontSize(props: Record<string, any>, style: Record<string, any> | undefined): number | undefined {
  // 1. Inline style fontSize
  if (style?.fontSize != null) {
    const m = String(style.fontSize).match(RE_FONT_SIZE_PX)
    if (m)
      return Number.parseFloat(m[1]!)
  }
  // 2. Tailwind arbitrary text-[Npx] from class or tw
  const twStr = props.tw || props.class || ''
  const twMatch = twStr.match(RE_TW_TEXT_ARBITRARY)
  if (twMatch) {
    const val = Number.parseFloat(twMatch[1]!)
    if (twMatch[2] === 'px')
      return val
  }
  return undefined
}

async function vnodeToTakumiNode(vnode: VNode, inheritedFontSize: number): Promise<Node> {
  const { style, children, class: cls, tw, src, ...rest } = vnode.props

  const baseMetadata = {
    tw: tw || cls || undefined,
    style,
  }

  // SVG elements → convert to SVG string
  if (vnode.type === 'svg') {
    // Only resolve em/rem to pixels when we have an explicit font size from a parent
    // (e.g. text-[80px]). When using the default 16px, leave dimensions unset so
    // takumi can handle the SVG's native 1em sizing and keep inline layout.
    const hasExplicitFontSize = inheritedFontSize !== DEFAULT_FONT_SIZE
    const isRelativeW = RE_RELATIVE_UNIT.test(String(rest.width ?? ''))
    const isRelativeH = RE_RELATIVE_UNIT.test(String(rest.height ?? ''))
    return {
      ...baseMetadata,
      type: 'image',
      src: vnodeToHtmlString(vnode),
      // When em/rem + explicit parent font size → resolve to px.
      // When em/rem + default font size → leave undefined (takumi handles natively).
      // Otherwise → use standard resolution chain (numeric attrs → style → viewBox).
      width: isRelativeW
        ? (hasExplicitFontSize ? resolveRelativeUnit(rest.width, inheritedFontSize) : undefined)
        : resolveSvgDimension(rest, style, 'width'),
      height: isRelativeH
        ? (hasExplicitFontSize ? resolveRelativeUnit(rest.height, inheritedFontSize) : undefined)
        : resolveSvgDimension(rest, style, 'height'),
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

  // Compute inherited font size for children
  const nodeFontSize = extractFontSize(vnode.props, style)
  const childFontSize = nodeFontSize ?? inheritedFontSize

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
    for (const child of children) {
      if (child && typeof child === 'object')
        takumiChildren.push(await vnodeToTakumiNode(child, childFontSize))
      else if (typeof child === 'string' && child.trim())
        takumiChildren.push({ type: 'text', text: child.trim() })
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

function vnodeToHtmlString(vnode: VNode): string {
  const { style, children, ...attrs } = vnode.props
  const attrParts: string[] = []

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
      .map(([k, v]) => `${kebabCase(k)}:${resolveValue(v)}`)
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
    attrParts.push(`${finalKey}="${String(resolveValue(val)).replace(RE_DQUOTE, '&quot;')}"`)
  }

  const open = attrParts.length ? `<${vnode.type} ${attrParts.join(' ')}>` : `<${vnode.type}>`

  const inner = Array.isArray(children)
    ? (children as (VNode | string)[]).map((c) => {
        if (typeof c === 'string')
          return c.replace(RE_AMP, '&amp;').replace(RE_LT, '&lt;').replace(RE_GT, '&gt;')
        if (c && typeof c === 'object')
          return vnodeToHtmlString(c)
        return ''
      }).join('')
    : (typeof children === 'string' ? children.replace(RE_AMP, '&amp;').replace(RE_LT, '&lt;').replace(RE_GT, '&gt;') : '')

  return `${open}${inner}</${vnode.type}>`
}
