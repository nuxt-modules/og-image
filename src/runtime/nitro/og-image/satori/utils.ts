import type { OgImageRenderEventContext, SatoriTransformer, VNode } from '../../../types'

export function walkSatoriTree(e: OgImageRenderEventContext, node: VNode, plugins: (SatoriTransformer | SatoriTransformer[])[]) {
  const promises: (Promise<void> | void)[] = []
  if (!node.props?.children || !Array.isArray(node.props.children))
    return promises
  // remove empty children
  if (node.props.children.length === 0) {
    delete node.props.children
    return promises
  }
  // walk tree of nodes
  for (const child of node.props.children || []) {
    if (child) {
      for (const plugin of plugins.flat()) {
        if (plugin.filter(child))
          promises.push(plugin.transform(child, e))
      }
      promises.push(
        ...walkSatoriTree(e, child, plugins),
      )
    }
  }
  return promises
}

export function defineSatoriTransformer(transformer: SatoriTransformer | SatoriTransformer[]) {
  return transformer
}
