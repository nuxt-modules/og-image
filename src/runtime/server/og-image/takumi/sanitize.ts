import { resolveColorMix } from '../utils/css'

const VALID_VERTICAL_ALIGN = new Set(['baseline', 'top', 'middle', 'bottom', 'text-top', 'text-bottom', 'sub', 'super', 'initial', 'inherit'])

export function sanitizeTakumiStyles(node: any) {
  if (node.style) {
    for (const prop of Object.keys(node.style)) {
      const value = node.style[prop]
      if (typeof value !== 'string')
        continue
      let v = value
      // Resolve color-mix() to rgba
      if (v.includes('color-mix('))
        v = resolveColorMix(v)
      // If color-mix() still present after resolution, strip the property
      if (v.includes('color-mix(')) {
        delete node.style[prop]
        continue
      }
      // Strip properties with unresolved var() references
      if (v.includes('var(')) {
        delete node.style[prop]
        continue
      }
      // Strip modern color functions the WASM renderer can't handle
      if (/\b(?:lab|lch|oklab|oklch|color)\(/.test(v)) {
        delete node.style[prop]
        continue
      }
      // Takumi only accepts keyword values for vertical-align
      if (prop === 'verticalAlign' && !VALID_VERTICAL_ALIGN.has(v)) {
        node.style[prop] = 'middle'
        continue
      }
      if (v !== value)
        node.style[prop] = v
    }
  }
  if (node.children) {
    for (const child of node.children)
      sanitizeTakumiStyles(child)
  }
}
