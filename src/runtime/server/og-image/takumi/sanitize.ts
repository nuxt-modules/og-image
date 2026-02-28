export function sanitizeTakumiStyles(node: any) {
  if (node.style) {
    for (const prop of Object.keys(node.style)) {
      const value = node.style[prop]
      // Strip properties with unresolved var() references
      if (typeof value === 'string' && value.includes('var(')) {
        delete node.style[prop]
      }
    }
  }
  if (node.children) {
    for (const child of node.children)
      sanitizeTakumiStyles(child)
  }
}
