import type { ElementNode, Node, TextNode } from 'ultrahtml'
import type { OgImageRenderEventContext } from '../../../types'
import { ELEMENT_NODE, parse, renderSync, TEXT_NODE } from 'ultrahtml'
import { querySelector } from 'ultrahtml/selector'
import { htmlDecodeQuotes } from '../../util/encoding'
import { fetchIsland } from '../../util/kit'
import { applyEmojis } from '../satori/transforms/emojis'
import { applyInlineCss } from '../satori/transforms/inlineCss'

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
  const doc = parse(template)
  const root = querySelector(doc, 'div') as ElementNode
  return elementToNode(root, ctx)
}

function getTextContent(node: Node): string {
  if (node.type === TEXT_NODE)
    return (node as TextNode).value
  if (node.type === ELEMENT_NODE) {
    return (node as ElementNode).children.map(child => getTextContent(child)).join('')
  }
  return ''
}

function elementToNode(el: ElementNode, ctx: OgImageRenderEventContext): TakumiNode {
  const { style, class: cls, src, width, height } = el.attributes

  if (el.name === 'img') {
    return {
      type: 'image',
      src: resolveImageSrc(src || '', ctx),
      width: Number(width) || undefined,
      height: Number(height) || undefined,
      tw: cls || undefined,
      style: parseStyleAttr(style),
    }
  }

  if (el.name === 'svg') {
    const svgString = renderSync(el)
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`
    return {
      type: 'image',
      src: dataUri,
      width: Number(width) || undefined,
      height: Number(height) || undefined,
    }
  }

  const firstChild = el.children[0]
  if (el.children.length === 1 && firstChild?.type === TEXT_NODE) {
    return {
      type: 'text',
      text: getTextContent(el),
      tw: cls || undefined,
      style: parseStyleAttr(style),
    }
  }

  const children: TakumiNode[] = []
  for (const child of el.children) {
    if (child.type === ELEMENT_NODE)
      children.push(elementToNode(child as ElementNode, ctx))
    else if (child.type === TEXT_NODE && (child as TextNode).value.trim())
      children.push({ type: 'text', text: (child as TextNode).value.trim() })
  }

  return {
    type: 'container',
    children: children.length ? children : undefined,
    tw: cls || undefined,
    style: parseStyleAttr(style),
  }
}

function resolveImageSrc(src: string, _ctx: OgImageRenderEventContext): string {
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://'))
    return src
  return src
}

function parseStyleAttr(style: string | null | undefined): Record<string, any> | undefined {
  if (!style)
    return undefined
  const result: Record<string, any> = {}
  for (const decl of style.split(';')) {
    const [prop, ...valParts] = decl.split(':')
    const val = valParts.join(':').trim()
    if (prop?.trim() && val)
      result[camelCase(prop.trim())] = val
  }
  return Object.keys(result).length ? result : undefined
}

function camelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}
