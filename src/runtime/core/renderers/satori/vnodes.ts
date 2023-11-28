import { html as convertHtmlToSatori } from 'satori-html'
import type { H3Event } from 'h3'
import type { RendererOptions, VNode } from '../../../types'
import { fetchHTML } from '../../html/fetch'
import { walkSatoriTree } from './utils'
import emojis from './plugins/emojis'
import twClasses from './plugins/twClasses'
import imageSrc from './plugins/imageSrc'
import flex from './plugins/flex'
import encoding from './plugins/encoding'

export async function createVNodes(e: H3Event, options: RendererOptions): Promise<VNode> {
  const html = options.html || await fetchHTML(e, options)
  // get the body content of the html
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] || html

  // scan html for all css links and load them
  const satoriTree = convertHtmlToSatori(body)
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
