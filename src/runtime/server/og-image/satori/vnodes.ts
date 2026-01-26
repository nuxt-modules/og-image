import type { FontConfig, OgImageRenderEventContext, VNode } from '../../../types'
import resolvedFonts from '#og-image/fonts'
import { html as convertHtmlToSatori } from 'satori-html'
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
  // scan html for all css links and load them
  const satoriTree = convertHtmlToSatori(template)
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
