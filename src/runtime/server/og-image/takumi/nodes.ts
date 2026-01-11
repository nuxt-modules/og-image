import type { OgImageRenderEventContext } from '../../../types'
import { parseHTML } from 'linkedom'
import { htmlDecodeQuotes } from '../../util/encoding'
import { fetchIsland } from '../../util/kit'
import { applyEmojis } from '../satori/transforms/emojis'
import { applyInlineCss } from '../satori/transforms/inlineCss'

export interface TakumiNode {
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
    const island = await fetchIsland(ctx.e, ctx.options.component!, typeof ctx.options.props !== 'undefined' ? ctx.options.props : ctx.options)
    island.html = htmlDecodeQuotes(island.html)
    await applyInlineCss(ctx, island)
    await applyEmojis(ctx, island)
    html = island.html
    if (html?.includes('<body>'))
      html = html.match(/<body>([\s\S]*)<\/body>/)?.[1] || ''
  }

  const template = `<div style="position: relative; display: flex; margin: 0 auto; width: ${ctx.options.width}px; height: ${ctx.options.height}px; overflow: hidden;">${html}</div>`
  const { document } = parseHTML(template)
  const root = document.body.firstElementChild || document.body

  return elementToNode(root as Element, ctx)
}

function elementToNode(el: Element, ctx: OgImageRenderEventContext): TakumiNode {
  const tagName = el.tagName.toLowerCase()

  // Handle images
  if (tagName === 'img') {
    return {
      src: resolveImageSrc(el.getAttribute('src') || '', ctx),
      width: Number(el.getAttribute('width')) || undefined,
      height: Number(el.getAttribute('height')) || undefined,
      tw: el.getAttribute('class') || undefined,
      style: parseStyleAttr(el.getAttribute('style')),
    }
  }

  // Handle SVG - convert to data URI
  if (tagName === 'svg') {
    const svgString = el.outerHTML
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`
    return {
      src: dataUri,
      width: Number(el.getAttribute('width')) || undefined,
      height: Number(el.getAttribute('height')) || undefined,
    }
  }

  // Handle text-only elements
  const firstChild = el.childNodes[0]
  if (el.childNodes.length === 1 && firstChild?.nodeType === 3) {
    return {
      text: el.textContent || '',
      tw: el.getAttribute('class') || undefined,
      style: parseStyleAttr(el.getAttribute('style')),
    }
  }

  // Handle containers
  const children: TakumiNode[] = []
  for (const child of el.childNodes) {
    if (child.nodeType === 1)
      children.push(elementToNode(child as Element, ctx))
    else if (child.nodeType === 3 && child.textContent?.trim())
      children.push({ text: child.textContent.trim() })
  }

  return {
    children: children.length ? children : undefined,
    tw: el.getAttribute('class') || undefined,
    style: parseStyleAttr(el.getAttribute('style')),
  }
}

function resolveImageSrc(src: string, _ctx: OgImageRenderEventContext): string {
  // Already a data URI or absolute URL
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://'))
    return src
  // Relative path - return as-is and let Takumi handle it
  return src
}

function parseStyleAttr(style: string | null): Record<string, any> | undefined {
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
