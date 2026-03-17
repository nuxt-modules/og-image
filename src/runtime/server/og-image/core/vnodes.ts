import type { ElementNode, TextNode } from 'ultrahtml'
import type { OgImageRenderEventContext, VNode } from '../../../types'
import { ELEMENT_NODE, parse, TEXT_NODE } from 'ultrahtml'
import { querySelector } from 'ultrahtml/selector'
import { decodeHtml, htmlDecodeQuotes } from '../../util/encoding'
import { fetchIsland } from '../../util/kit'
import { logger } from '../../util/logger'
import { splitCssDeclarations } from '../utils/css'
import { walkTree } from './plugins'
import encoding from './plugins/encoding'
import imageSrc from './plugins/imageSrc'
import styleDirectives from './plugins/styleDirectives'
import { applyEmojis } from './transforms/emojis'

const RE_KEBAB_SEGMENT = /-([a-z])/g
const RE_AMP_ENTITY = /&amp;/g
const RE_CSS_QUOTES = /^['"](.+)['"]$/
const RE_IMPORTANT = /\s*!important\s*$/
const RE_BODY_CONTENT = /<body>([\s\S]*)<\/body>/

function camelCase(str: string): string {
  return str.replace(RE_KEBAB_SEGMENT, (_, c) => c.toUpperCase())
}

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
    const parts = vb.split(/[\s,]+/)
    if (parts.length === 4) {
      const n = Number(parts[key === 'width' ? 2 : 3])
      if (!Number.isNaN(n))
        return n
    }
  }
}

export function parseStyleAttr(style: string | null | undefined): Record<string, any> | undefined {
  if (!style)
    return undefined
  const result: Record<string, any> = {}
  // Decode &amp; before splitting — the `;` in `&amp;` would otherwise act as
  // a CSS declaration separator and truncate values containing `&` (e.g. URLs).
  for (const decl of splitCssDeclarations(style.replace(RE_AMP_ENTITY, '&'))) {
    const colonIdx = decl.indexOf(':')
    if (colonIdx === -1)
      continue
    const prop = decl.slice(0, colonIdx).trim()
    const val = decl.slice(colonIdx + 1).trim()
    if (prop && val) {
      // Strip !important — Satori/Takumi don't support CSS specificity
      // Strip CSS quotes from font-family — Satori matches font names as plain
      // strings (e.g. "JetBrains Mono"), not CSS-quoted values ("'JetBrains Mono'")
      const cleanVal = val.replace(RE_IMPORTANT, '')
      result[camelCase(prop)] = prop === 'font-family'
        ? cleanVal.replace(RE_CSS_QUOTES, '$1')
        : cleanVal
    }
  }
  return Object.keys(result).length ? result : undefined
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
  if (!html) {
    const island = await fetchIsland(ctx.e, ctx.options.component!, typeof ctx.options.props !== 'undefined' ? ctx.options.props as Record<string, any> : ctx.options)
    // this fixes any inline style props that need to be wrapped in single quotes, such as:
    // background image, fonts, etc
    island.html = htmlDecodeQuotes(island.html)
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
  // run shared plugins
  await Promise.all(walkTree(ctx, vnodeTree, [encoding, styleDirectives, imageSrc]))
  return vnodeTree
}
