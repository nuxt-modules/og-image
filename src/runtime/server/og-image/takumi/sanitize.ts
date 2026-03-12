import { logger } from '../../util/logger'

const warnedVars = new Set<string>()

export function sanitizeTakumiStyles(node: any) {
  if (node.style) {
    for (const prop of Object.keys(node.style)) {
      const value = node.style[prop]
      // Strip properties with unresolved var() references
      if (typeof value === 'string' && value.includes('var(')) {
        if (!warnedVars.has(value)) {
          warnedVars.add(value)
          logger.warn(`[nuxt-og-image] Unresolved CSS variable in "${prop}: ${value}" — style will be dropped. Ensure CSS variables are available at build time.`)
        }
        delete node.style[prop]
      }
    }
  }
  if (node.children) {
    for (const child of node.children)
      sanitizeTakumiStyles(child)
  }
}
