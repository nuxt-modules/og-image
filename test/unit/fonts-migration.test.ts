import { describe, expect, it } from 'vitest'

// Test the parsing helpers directly
function parseFontString(font: string): { name: string, weight: number, style: 'normal' | 'italic' } {
  const parts = font.split(':')
  if (parts.length === 3) {
    return {
      name: parts[0] || font,
      style: parts[1] === 'ital' ? 'italic' : 'normal',
      weight: Number.parseInt(parts[2] || '') || 400,
    }
  }
  return {
    name: parts[0] || font,
    weight: Number.parseInt(parts[1] || '') || 400,
    style: 'normal',
  }
}

function groupFontsByFamily(fonts: string[]) {
  const families = new Map<string, { weights: Set<number>, styles: Set<'normal' | 'italic'> }>()

  for (const font of fonts) {
    const parsed = parseFontString(font)
    const existing = families.get(parsed.name)
    if (existing) {
      existing.weights.add(parsed.weight)
      existing.styles.add(parsed.style)
    }
    else {
      families.set(parsed.name, {
        weights: new Set([parsed.weight]),
        styles: new Set([parsed.style]),
      })
    }
  }

  return Array.from(families.entries()).map(([name, { weights, styles }]) => ({
    name,
    weights: Array.from(weights).sort((a, b) => a - b),
    styles: Array.from(styles),
  }))
}

describe('fonts migration', () => {
  describe('parseFontString', () => {
    it('parses simple font name', () => {
      expect(parseFontString('Inter')).toEqual({
        name: 'Inter',
        weight: 400,
        style: 'normal',
      })
    })

    it('parses font with weight', () => {
      expect(parseFontString('Inter:700')).toEqual({
        name: 'Inter',
        weight: 700,
        style: 'normal',
      })
    })

    it('parses italic font', () => {
      expect(parseFontString('Inter:ital:400')).toEqual({
        name: 'Inter',
        weight: 400,
        style: 'italic',
      })
    })
  })

  describe('groupFontsByFamily', () => {
    it('groups multiple weights', () => {
      const result = groupFontsByFamily(['Inter:400', 'Inter:700'])
      expect(result).toEqual([
        { name: 'Inter', weights: [400, 700], styles: ['normal'] },
      ])
    })

    it('groups multiple families', () => {
      const result = groupFontsByFamily(['Inter:400', 'Roboto:500'])
      expect(result).toEqual([
        { name: 'Inter', weights: [400], styles: ['normal'] },
        { name: 'Roboto', weights: [500], styles: ['normal'] },
      ])
    })

    it('includes italic style', () => {
      const result = groupFontsByFamily(['Inter:400', 'Inter:ital:700'])
      expect(result).toEqual([
        { name: 'Inter', weights: [400, 700], styles: ['normal', 'italic'] },
      ])
    })
  })
})
