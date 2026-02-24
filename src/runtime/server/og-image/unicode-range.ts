import type { VNode } from '../../types'

/** Parse a CSS unicode-range string (e.g. "U+0900-097F, U+0980-09FF") into codepoint ranges */
export function parseUnicodeRange(range: string): [number, number][] | null {
  const parts = range.split(',').map(s => s.trim()).filter(Boolean)
  const result: [number, number][] = []
  for (const part of parts) {
    const match = part.match(/^U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?$/)
    if (!match)
      return null
    const start = Number.parseInt(match[1]!, 16)
    const end = match[2] ? Number.parseInt(match[2], 16) : start
    result.push([start, end])
  }
  return result.length > 0 ? result : null
}

/** Test whether any codepoint in the set falls within the given ranges */
export function codepointsIntersectRanges(codepoints: Set<number>, ranges: [number, number][]): boolean {
  for (const cp of codepoints) {
    for (const [start, end] of ranges) {
      if (cp >= start && cp <= end)
        return true
    }
  }
  return false
}

/** Extract all codepoints from text content in a satori VNode tree */
export function extractCodepointsFromVNodes(node: VNode): Set<number> {
  const codepoints = new Set<number>()
  const walk = (n: VNode) => {
    const { children } = n.props
    if (typeof children === 'string') {
      for (const ch of children) {
        codepoints.add(ch.codePointAt(0)!)
      }
    }
    else if (Array.isArray(children)) {
      for (const child of children) {
        if (child == null)
          continue
        if (typeof child === 'string') {
          for (const ch of child) {
            codepoints.add(ch.codePointAt(0)!)
          }
        }
        else {
          walk(child)
        }
      }
    }
  }
  walk(node)
  return codepoints
}

/** Extract all codepoints from text content in a takumi node tree */
export function extractCodepointsFromTakumiNodes(node: { text?: string, children?: any[] }): Set<number> {
  const codepoints = new Set<number>()
  const walk = (n: { text?: string, children?: any[] }) => {
    if (typeof n.text === 'string') {
      for (const ch of n.text) {
        codepoints.add(ch.codePointAt(0)!)
      }
    }
    if (Array.isArray(n.children)) {
      for (const child of n.children)
        walk(child)
    }
  }
  walk(node)
  return codepoints
}
