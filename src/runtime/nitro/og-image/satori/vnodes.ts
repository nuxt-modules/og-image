import { html as convertHtmlToSatori } from 'satori-html'
import { htmlDecodeQuotes } from '../../util/encoding'
import { fetchIsland } from '../../util/kit'
import classes from './plugins/classes'
import emojis from './plugins/emojis'
import encoding from './plugins/encoding'
import flex from './plugins/flex'
import imageSrc from './plugins/imageSrc'
import unocss from './plugins/unocss'
import { applyEmojis } from './transforms/emojis'
import { applyInlineCss } from './transforms/inlineCss'
import { walkSatoriTree } from './utils'
import type { OgImageRenderEventContext, VNode } from '../../../types'

export async function createVNodes(ctx: OgImageRenderEventContext): Promise<VNode> {
  let html = ctx.options.html
  if (!html) {
    const island = await fetchIsland(ctx.e, ctx.options.component!, typeof ctx.options.props !== 'undefined' ? ctx.options.props : ctx.options)
    // this fixes any inline style props that need to be wrapped in single quotes, such as:
    // background image, fonts, etc
    island.html = htmlDecodeQuotes(island.html)
    // pre-transform HTML
    await applyInlineCss(ctx, island)
    await applyEmojis(ctx, island)
    html = island.html
    if (html?.includes('<body>')) {
      // get inner contents of body
      html = html.match(/<body>([\s\S]*)<\/body>/)?.[1] || ''
    }
  }
  // get the body content of the html
  const template = `<div style="position: relative; display: flex; margin: 0 auto; width: ${ctx.options.width}px; height: ${ctx.options.height}px; overflow: hidden;">${html}</div>`
  // scan html for all css links and load them
  const satoriTree = convertHtmlToSatori(template)
  // do sync transforms
  walkSatoriTree(ctx, satoriTree, [
    emojis,
    classes,
    flex,
    encoding,
  ])
  // do async transforms
  await Promise.all(walkSatoriTree(ctx, satoriTree, [
    unocss,
    imageSrc,
  ]))
  return satoriTree
}
