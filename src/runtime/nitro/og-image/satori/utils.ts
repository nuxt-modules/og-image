import type { OgImageRenderEventContext, SatoriTransformer, VNode } from '../../../types'

export async function walkSatoriTree(e: OgImageRenderEventContext, node: VNode, plugins: (SatoriTransformer | SatoriTransformer[])[]) {
  if (!node.props?.children || !Array.isArray(node.props.children))
    return
  // remove empty children
  if (node.props.children.length === 0) {
    delete node.props.children
    return
  }
  // walk tree of nodes
  for (const child of node.props.children || []) {
    if (child) {
      for (const plugin of plugins.flat()) {
        if (plugin.filter(child))
          await plugin.transform(child, e)
      }
      await walkSatoriTree(e, child, plugins)
    }
  }
}

export function defineSatoriTransformer(transformer: SatoriTransformer | SatoriTransformer[]) {
  return transformer
}
