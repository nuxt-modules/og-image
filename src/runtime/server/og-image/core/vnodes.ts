import type { ElementNode, TextNode } from 'ultrahtml'
import type { OgImageRenderEventContext, VNode } from '../../../types'
import { ELEMENT_NODE, parse, TEXT_NODE } from 'ultrahtml'
import { querySelector } from 'ultrahtml/selector'
import { decodeHtml } from '../../util/encoding'
import { fetchIsland } from '../../util/kit'
import { logger } from '../../util/logger'
import { walkTree } from './plugins'
import encoding from './plugins/encoding'
import imageSrc from './plugins/imageSrc'
import styleDirectives from './plugins/styleDirectives'
import { parseStyleAttr } from './style-attr'
import { applyEmojis } from './transforms/emojis'

export { parseStyleAttr }

const RE_BODY_CONTENT = /<body>([\s\S]*)<\/body>/

// SVG attributes that must preserve their camelCase form.
// HTML parsers lowercase all attributes, but SVG is case-sensitive.
const SVG_CAMEL_ATTRS: Record<string, string> = {
  viewbox: 'viewBox',
  preserveaspectratio: 'preserveAspectRatio',
  basefrequency: 'baseFrequency',
  baseprofile: 'baseProfile',
  clippathunits: 'clipPathUnits',
  diffuseconstant: 'diffuseConstant',
  edgemode: 'edgeMode',
  filterunits: 'filterUnits',
  glyphref: 'glyphRef',
  gradienttransform: 'gradientTransform',
  gradientunits: 'gradientUnits',
  kernelmatrix: 'kernelMatrix',
  kernelunitlength: 'kernelUnitLength',
  keypoints: 'keyPoints',
  keysplines: 'keySplines',
  keytimes: 'keyTimes',
  lengthadjust: 'lengthAdjust',
  limitingconeangle: 'limitingConeAngle',
  markerheight: 'markerHeight',
  markerunits: 'markerUnits',
  markerwidth: 'markerWidth',
  maskcontentunits: 'maskContentUnits',
  maskunits: 'maskUnits',
  numoctaves: 'numOctaves',
  pathlength: 'pathLength',
  patterncontentunits: 'patternContentUnits',
  patterntransform: 'patternTransform',
  patternunits: 'patternUnits',
  pointsatx: 'pointsAtX',
  pointsaty: 'pointsAtY',
  pointsatz: 'pointsAtZ',
  repeatcount: 'repeatCount',
  repeatdur: 'repeatDur',
  requiredextensions: 'requiredExtensions',
  specularconstant: 'specularConstant',
  specularexponent: 'specularExponent',
  spreadmethod: 'spreadMethod',
  startoffset: 'startOffset',
  stddeviation: 'stdDeviation',
  stitchtiles: 'stitchTiles',
  surfacescale: 'surfaceScale',
  systemlanguage: 'systemLanguage',
  tablevalues: 'tableValues',
  targetx: 'targetX',
  targety: 'targetY',
  textlength: 'textLength',
  xchannelselector: 'xChannelSelector',
  ychannelselector: 'yChannelSelector',
  zoomandpan: 'zoomAndPan',
}

export const SVG_CAMEL_ATTR_VALUES = new Set(Object.values(SVG_CAMEL_ATTRS))

const RE_PERCENT = /^\d+%$/
const RE_VIEWBOX_SEP = /[\s,]+/

/**
 * Resolve an SVG element's width or height from multiple sources:
 * 1. Numeric HTML attribute (e.g. width="24")
 * 2. Style property (e.g. style.width = 48 or "48px")
 * 3. viewBox (3rd/4th value for width/height)
 *
 * Percentage attributes are skipped (returned as undefined) so callers
 * can fall back to ancestor or renderer-specific resolution.
 */
export function resolveSvgDimension(
  props: Record<string, any>,
  style: Record<string, any> | undefined,
  key: 'width' | 'height',
): number | undefined {
  // 1. HTML attribute (skip percentages)
  const attr = props[key]
  if (attr != null && !RE_PERCENT.test(String(attr))) {
    const n = Number(attr)
    if (!Number.isNaN(n))
      return n
  }
  // 2. Style property
  const sv = style?.[key]
  if (sv != null) {
    const n = typeof sv === 'number' ? sv : Number.parseInt(String(sv))
    if (!Number.isNaN(n))
      return n
  }
  // 3. viewBox fallback
  const vb = props.viewBox || props.viewbox
  if (typeof vb === 'string') {
    const parts = vb.split(RE_VIEWBOX_SEP)
    if (parts.length === 4) {
      const n = Number(parts[key === 'width' ? 2 : 3])
      if (!Number.isNaN(n))
        return n
    }
  }
}

export function elementToVNode(el: ElementNode): VNode {
  const props: VNode['props'] = {}

  const { style, ...attrs } = el.attributes
  const parsedStyle = parseStyleAttr(style)
  if (parsedStyle)
    props.style = parsedStyle

  for (const [name, value] of Object.entries(attrs)) {
    const key = SVG_CAMEL_ATTRS[name] || name
    props[key] = typeof value === 'string' ? decodeHtml(value) : value
  }

  const children: (VNode | string)[] = []
  for (const child of el.children) {
    if (child.type === ELEMENT_NODE) {
      children.push(elementToVNode(child as ElementNode))
    }
    else if (child.type === TEXT_NODE) {
      const text = (child as TextNode).value
      if (text.trim())
        children.push(text)
    }
  }

  if (children.length)
    props.children = children

  return { type: el.name, props } as VNode
}

export function htmlToVNode(html: string): VNode {
  const doc = parse(html)
  const root = querySelector(doc, 'div') as ElementNode | null
  if (!root)
    throw new Error('Failed to parse HTML - no root div found')
  return elementToVNode(root)
}

// SVG elements that cannot be rendered by Satori or Takumi and will be silently dropped
const UNSUPPORTED_SVG_ELEMENTS = new Set(['text', 'tspan', 'textPath', 'foreignObject', 'switch', 'a'])

export function warnUnsupportedSvgElements(vnode: VNode, component?: string) {
  const unsupported = new Set<string>()
  const collectUnsupported = (node: VNode) => {
    if (UNSUPPORTED_SVG_ELEMENTS.has(node.type))
      unsupported.add(`<${node.type}>`)
    if (Array.isArray(node.props?.children)) {
      for (const child of node.props.children) {
        if (child && typeof child === 'object')
          collectUnsupported(child)
      }
    }
  }
  const walk = (node: VNode) => {
    if (node.type === 'svg') {
      collectUnsupported(node)
    }
    else if (Array.isArray(node.props?.children)) {
      for (const child of node.props.children) {
        if (child && typeof child === 'object')
          walk(child)
      }
    }
  }
  walk(vnode)
  if (unsupported.size) {
    const elements = [...unsupported].join(', ')
    const source = component ? ` in "${component}"` : ''
    logger.warn(`SVG ${elements} elements${source} are not supported by image renderers and will not be displayed. Convert text to <path> elements instead.`)
  }
}

export interface CreateVNodesOptions {
  wrapperStyle?: string
}

export async function createVNodes(ctx: OgImageRenderEventContext, options?: CreateVNodesOptions): Promise<VNode> {
  let html = ctx.options.html
  if (html) {
    logger.warn('The `html` option is deprecated and will be removed in the next major version. Use a Vue component instead.')
  }
  if (!html) {
    const islandTimeout = ctx.runtimeConfig.security?.renderTimeout ?? 15_000
    const island = await ctx.timings.measure('island-fetch', () => fetchIsland(ctx.e, ctx.options.component!, typeof ctx.options.props !== 'undefined' ? ctx.options.props as Record<string, any> : ctx.options, islandTimeout))
    // pre-transform HTML - apply emoji replacements
    await applyEmojis(ctx, island)
    html = island.html
    if (html?.includes('<body>')) {
      // get inner contents of body
      html = html.match(RE_BODY_CONTENT)?.[1] || ''
    }
  }
  const baseStyle = `position: relative; display: flex; margin: 0 auto; width: ${ctx.options.width}px; height: ${ctx.options.height}px; overflow: hidden;`
  const fullStyle = options?.wrapperStyle ? `${baseStyle} ${options.wrapperStyle}` : baseStyle
  const template = `<div style="${fullStyle}">${html}</div>`
  // convert html to vnode tree
  const vnodeTree = htmlToVNode(template)
  // ensure root component element fills the container
  const rootChild = vnodeTree.props.children?.[0]
  if (rootChild && typeof rootChild === 'object') {
    rootChild.props.style = { width: '100%', height: '100%', ...rootChild.props.style }
  }
  warnUnsupportedSvgElements(vnodeTree, ctx.options.component)
  // run shared plugins (encoding, styleDirectives, imageSrc); image-fetch
  // attributes externally so vnode-walk reflects everything else.
  await ctx.timings.measure('vnode-walk', () => Promise.all(walkTree(ctx, vnodeTree, [encoding, styleDirectives, imageSrc])))
  return vnodeTree
}
