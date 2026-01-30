import type { FontConfig, OgImageRenderEventContext, VNode } from '../../../types'
import resolvedFonts from '#og-image/fonts'
import { parseHTML } from 'linkedom'
import { htmlDecodeQuotes } from '../../util/encoding'
import { fetchIsland } from '../../util/kit'
import classes from './plugins/classes'
import emojis from './plugins/emojis'
import encoding from './plugins/encoding'
import flex from './plugins/flex'
import imageSrc from './plugins/imageSrc'
import nuxtIcon from './plugins/nuxt-icon'
import twClasses from './plugins/twClasses'
import { applyEmojis } from './transforms/emojis'
import { applyInlineCss } from './transforms/inlineCss'
import { walkSatoriTree } from './utils'

/**
 * Convert kebab-case to camelCase for CSS properties
 */
function camelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

/**
 * Parse inline style attribute into object with camelCased keys
 */
function parseStyleAttr(style: string | null): Record<string, any> | undefined {
  if (!style)
    return undefined
  const result: Record<string, any> = {}
  for (const decl of style.split(';')) {
    const colonIdx = decl.indexOf(':')
    if (colonIdx === -1)
      continue
    const prop = decl.slice(0, colonIdx).trim()
    const val = decl.slice(colonIdx + 1).trim()
    if (prop && val)
      result[camelCase(prop)] = val
  }
  return Object.keys(result).length ? result : undefined
}

/**
 * Convert a linkedom Element to Satori VNode format
 */
function elementToVNode(el: Element): VNode {
  const tagName = el.tagName.toLowerCase()
  const props: VNode['props'] = {}

  // Parse style attribute
  const style = parseStyleAttr(el.getAttribute('style'))
  if (style)
    props.style = style

  // Copy other relevant attributes (class will be handled by twClasses plugin)
  for (const attr of el.attributes) {
    if (attr.name === 'style')
      continue
    props[attr.name] = attr.value
  }

  // Process children
  const children: (VNode | string)[] = []
  for (const child of el.childNodes) {
    if (child.nodeType === 1) {
      // Element node
      children.push(elementToVNode(child as Element))
    }
    else if (child.nodeType === 3) {
      // Text node - only add if non-empty
      const text = child.textContent || ''
      if (text.trim())
        children.push(text)
    }
  }

  if (children.length)
    props.children = children

  return { type: tagName, props } as VNode
}

/**
 * Convert HTML string to Satori VNode using linkedom
 */
function htmlToVNode(html: string): VNode {
  const { document } = parseHTML(html)
  const root = document.querySelector('div')
  if (!root)
    throw new Error('Failed to parse HTML - no root div found')
  return elementToVNode(root)
}

// Get default font family from resolved fonts
function getDefaultFontFamily(): string {
  const fonts = resolvedFonts as FontConfig[]
  const firstFont = fonts[0]
  if (firstFont)
    return `'${firstFont.family}', sans-serif`
  return 'sans-serif'
}

export async function createVNodes(ctx: OgImageRenderEventContext): Promise<VNode> {
  let html = ctx.options.html
  if (!html) {
    const island = await fetchIsland(ctx.e, ctx.options.component!, typeof ctx.options.props !== 'undefined' ? ctx.options.props as Record<string, any> : ctx.options)
    // this fixes any inline style props that need to be wrapped in single quotes, such as:
    // background image, fonts, etc
    island.html = htmlDecodeQuotes(island.html)
    // pre-transform HTML - apply emoji replacements and inline CSS
    await applyEmojis(ctx, island)
    await applyInlineCss(ctx, island)
    html = island.html
    if (html?.includes('<body>')) {
      // get inner contents of body
      html = html.match(/<body>([\s\S]*)<\/body>/)?.[1] || ''
    }
  }
  // get the body content of the html
  const defaultFont = getDefaultFontFamily()
  const template = `<div style="position: relative; display: flex; margin: 0 auto; width: ${ctx.options.width}px; height: ${ctx.options.height}px; overflow: hidden; font-family: ${defaultFont};">${html}</div>`
  // convert html to satori vnode tree
  const satoriTree = htmlToVNode(template)
  // do sync transforms
  walkSatoriTree(ctx, satoriTree, [
    classes,
    flex,
    encoding,
    nuxtIcon,
    twClasses, // Convert class -> tw and handle breakpoints
  ])
  // do async transforms
  await Promise.all(walkSatoriTree(ctx, satoriTree, [
    emojis,
    imageSrc,
  ]))
  return satoriTree
}
