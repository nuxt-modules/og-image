import type { OgImageRenderEventContext, SatoriTransformer, VNode } from '../../../types'

export function walkSatoriTree(e: OgImageRenderEventContext, node: VNode, plugins: (SatoriTransformer | SatoriTransformer[])[]) {
  const promises: (Promise<void> | void)[] = []

  // Apply plugins to the current node
  for (const plugin of plugins.flat()) {
    if (plugin.filter(node)) {
      promises.push(plugin.transform(node, e))
    }
  }

  // If node has no children or they're not an array, we're done with this branch
  if (!node.props?.children || !Array.isArray(node.props.children))
    return promises

  // remove empty children
  if (node.props.children.length === 0) {
    delete node.props.children
    return promises
  }

  // walk tree of child nodes
  for (const child of node.props.children || []) {
    if (child) {
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
