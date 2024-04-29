import { html as convertHtmlToSatori } from 'satori-html'
import type { OgImageRenderEventContext, VNode } from '../../../types'
import { fetchIsland } from '../../util/kit'
import { htmlDecodeQuotes } from '../../util/encoding'
import { applyInlineCss } from './transforms/inlineCss'
import { applyEmojis } from './transforms/emojis'
import { walkSatoriTree } from './utils'
import unocss from './plugins/unocss'
import emojis from './plugins/emojis'
import classes from './plugins/classes'
import imageSrc from './plugins/imageSrc'
import flex from './plugins/flex'
import encoding from './plugins/encoding'

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
  }
  // get the body content of the html
  const template = `<div style="position: relative; display: flex; margin: 0 auto; width: ${ctx.options.width}px; height: ${ctx.options.height}px; overflow: hidden;">${html}</div>`

  // scan html for all css links and load them
  const satoriTree = convertHtmlToSatori(template)
  // process the tree
  await Promise.all(walkSatoriTree(ctx, satoriTree, [
    unocss,
    emojis,
    classes,
    imageSrc,
    flex,
    encoding,
  ]))
  return satoriTree
}
