export function sanitizeTakumiStyles(node: any) {
  if (node.style) {
    for (const prop of Object.keys(node.style)) {
      const value = node.style[prop]
      if (typeof value !== 'string')
        continue
      let v = value
      // Strip properties with unresolved var() references
      if (v.includes('var(')) {
        delete node.style[prop]
        continue
      }
    }
  }
  if (node.children) {
    for (const child of node.children)
      sanitizeTakumiStyles(child)
  }
}
