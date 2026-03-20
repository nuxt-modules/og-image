import { describe, expect, it } from 'vitest'

// These mirror the pure functions from src/runtime/server/og-image/takumi/renderer.ts.
// Tests verify that font-family rewriting uses real family names (not subset names
// like "Inter__0") so that takumi can do proper font-weight matching within a family.

const RE_QUOTES = /['"]/g

function lookupFontFamily(family: string, loadedFamilies: Set<string>): string | undefined {
  if (loadedFamilies.has(family))
    return family
  for (const loaded of loadedFamilies) {
    if (loaded.toLowerCase() === family.toLowerCase())
      return loaded
  }
}

interface MockNode {
  style?: Record<string, any>
  children?: MockNode[]
}

function rewriteFontFamilies(node: MockNode, loadedFamilies: Set<string>) {
  if (node.style?.fontFamily) {
    const families = (node.style.fontFamily as string).split(',').map((f: string) => f.trim().replace(RE_QUOTES, ''))
    const resolved = families.map((f: string) => lookupFontFamily(f, loadedFamilies) || f)
    const seen = new Set(resolved.map(f => f.toLowerCase()))
    for (const family of loadedFamilies) {
      if (!seen.has(family.toLowerCase())) {
        resolved.push(family)
        seen.add(family.toLowerCase())
      }
    }
    node.style.fontFamily = resolved.map((f: string) => `"${f}"`).join(', ')
  }
  if (node.children) {
    for (const child of node.children)
      rewriteFontFamilies(child, loadedFamilies)
  }
}

describe('takumi font-family rewriting', () => {
  describe('lookupFontFamily', () => {
    it('returns exact match', () => {
      const families = new Set(['Inter', 'Roboto'])
      expect(lookupFontFamily('Inter', families)).toBe('Inter')
    })

    it('returns case-insensitive match with canonical casing', () => {
      const families = new Set(['BIZ UDPGothic'])
      expect(lookupFontFamily('Biz UDPGothic', families)).toBe('BIZ UDPGothic')
    })

    it('returns undefined for unknown family', () => {
      const families = new Set(['Inter'])
      expect(lookupFontFamily('Arial', families)).toBeUndefined()
    })
  })

  describe('rewriteFontFamilies', () => {
    it('preserves real family names (no subset __N suffixes)', () => {
      const node: MockNode = {
        style: { fontFamily: 'Inter, sans-serif' },
      }
      const loaded = new Set(['Inter', 'Noto Sans'])
      rewriteFontFamilies(node, loaded)

      // Must use real family names, never subset names like "Inter__0"
      expect(node.style!.fontFamily).not.toMatch(/__\d+/)
      expect(node.style!.fontFamily).toContain('"Inter"')
    })

    it('resolves case-insensitive family and appends fallbacks', () => {
      const node: MockNode = {
        style: { fontFamily: '\'Biz UDPGothic\', sans-serif' },
      }
      const loaded = new Set(['BIZ UDPGothic', 'Inter'])
      rewriteFontFamilies(node, loaded)

      // Should resolve to canonical casing
      expect(node.style!.fontFamily).toContain('"BIZ UDPGothic"')
      // Should append Inter as fallback
      expect(node.style!.fontFamily).toContain('"Inter"')
      // Should keep unloaded families as-is
      expect(node.style!.fontFamily).toContain('"sans-serif"')
    })

    it('appends all loaded families as glyph fallback', () => {
      const node: MockNode = {
        style: { fontFamily: 'Roboto' },
      }
      const loaded = new Set(['Roboto', 'Noto Sans Devanagari', 'Inter'])
      rewriteFontFamilies(node, loaded)

      const result = node.style!.fontFamily
      // Primary family first
      expect(result.indexOf('"Roboto"')).toBeLessThan(result.indexOf('"Noto Sans Devanagari"'))
      // All loaded families present for glyph coverage
      expect(result).toContain('"Noto Sans Devanagari"')
      expect(result).toContain('"Inter"')
    })

    it('does not duplicate families already in the CSS', () => {
      const node: MockNode = {
        style: { fontFamily: 'Inter, Roboto' },
      }
      const loaded = new Set(['Inter', 'Roboto'])
      rewriteFontFamilies(node, loaded)

      const matches = node.style!.fontFamily.match(/"Inter"/g)
      expect(matches).toHaveLength(1)
    })

    it('recurses into children', () => {
      const child: MockNode = { style: { fontFamily: 'Roboto' } }
      const node: MockNode = {
        style: { fontFamily: 'Inter' },
        children: [child],
      }
      const loaded = new Set(['Inter', 'Roboto'])
      rewriteFontFamilies(node, loaded)

      expect(child.style!.fontFamily).toContain('"Roboto"')
      expect(child.style!.fontFamily).toContain('"Inter"')
    })

    it('skips nodes without fontFamily', () => {
      const node: MockNode = { style: { color: 'red' } }
      const loaded = new Set(['Inter'])
      rewriteFontFamilies(node, loaded)

      expect(node.style!.fontFamily).toBeUndefined()
      expect(node.style!.color).toBe('red')
    })
  })
})
