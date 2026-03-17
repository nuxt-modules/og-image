import type { VNode } from '../../types'

const RE_UNICODE_RANGE_PART = /^U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?$/

/** Parse a CSS unicode-range string (e.g. "U+0900-097F, U+0980-09FF") into codepoint ranges */
export function parseUnicodeRange(range: string): [number, number][] | null {
  const parts = range.split(',').map(s => s.trim()).filter(Boolean)
  const result: [number, number][] = []
  for (const part of parts) {
    const match = part.match(RE_UNICODE_RANGE_PART)
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

function addCodepointsFromString(str: string, codepoints: Set<number>) {
  for (const ch of str)
    codepoints.add(ch.codePointAt(0)!)
}

/**
 * Extract all codepoints from text content in a node tree.
 * Works with both satori VNodes (text in props.children) and takumi nodes (text in .text field).
 */
export function extractCodepoints(node: VNode | Record<string, any>): Set<number> {
  const codepoints = new Set<number>()
  const walk = (n: any) => {
    // Takumi: text field
    if (typeof n.text === 'string')
      addCodepointsFromString(n.text, codepoints)
    // Satori VNode: text in props.children
    const children = n.props?.children ?? n.children
    if (typeof children === 'string') {
      addCodepointsFromString(children, codepoints)
    }
    else if (Array.isArray(children)) {
      for (const child of children) {
        if (child == null)
          continue
        if (typeof child === 'string')
          addCodepointsFromString(child, codepoints)
        else
          walk(child)
      }
    }
  }
  walk(node)
  return codepoints
}
