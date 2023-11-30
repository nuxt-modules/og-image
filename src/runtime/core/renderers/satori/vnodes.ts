import { html as convertHtmlToSatori } from 'satori-html'
import type { H3Event } from 'h3'
import type { RendererOptions, VNode } from '../../../types'
import { fetchIsland } from '../../html/fetchIsland'
import { applyInlineCss } from '../../html/applyInlineCss'
import { walkSatoriTree } from './utils'
import emojis from './plugins/emojis'
import twClasses from './plugins/twClasses'
import imageSrc from './plugins/imageSrc'
import flex from './plugins/flex'
import encoding from './plugins/encoding'

export async function createVNodes(e: H3Event, options: RendererOptions): Promise<VNode> {
  let html = options.html
  if (!html) {
    const island = await fetchIsland(e, options)
    await applyInlineCss(island)
    html = island.html
  }
  // get the body content of the html
  const template = `<div data-v-inspector-ignore="true" style="position: relative; display: flex; margin: 0 auto; width: ${options.width}px; height: ${options.height}px; overflow: hidden;">${html}</div>`

  // scan html for all css links and load them
  const satoriTree = convertHtmlToSatori(template)
  // process the tree
  await walkSatoriTree(e, satoriTree, [
    emojis,
    twClasses,
    imageSrc,
    flex,
    encoding,
  ])
  // @todo allow users to hook into the vnode tree

  return satoriTree
}
