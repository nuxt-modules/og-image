import { describe, expect, it } from 'vitest'

// Test style parsing logic in isolation (same logic used in takumi/nodes.ts)
function parseStyleAttr(style: string | null): Record<string, any> | undefined {
  if (!style)
    return undefined
  const result: Record<string, any> = {}
  for (const decl of style.split(';')) {
    const [prop, ...valParts] = decl.split(':')
    const val = valParts.join(':').trim()
    if (prop?.trim() && val)
      result[camelCase(prop.trim())] = val
  }
  return Object.keys(result).length ? result : undefined
}

function camelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

describe('takumiNodes', () => {
  describe('parseStyleAttr', () => {
    it('parses simple style', () => {
      expect(parseStyleAttr('color: red')).toEqual({ color: 'red' })
    })

    it('parses multiple styles', () => {
      expect(parseStyleAttr('color: red; font-size: 16px')).toEqual({
        color: 'red',
        fontSize: '16px',
      })
    })

    it('handles background-image with url containing colon', () => {
      expect(parseStyleAttr('background-image: url(https://example.com/img.png)')).toEqual({
        backgroundImage: 'url(https://example.com/img.png)',
      })
    })

    it('returns undefined for empty style', () => {
      expect(parseStyleAttr('')).toBeUndefined()
      expect(parseStyleAttr(null)).toBeUndefined()
    })

    it('converts kebab-case to camelCase', () => {
      expect(parseStyleAttr('margin-top: 10px')).toEqual({ marginTop: '10px' })
    })

    it('handles complex background shorthand', () => {
      expect(parseStyleAttr('background: linear-gradient(to right, #000, #fff)')).toEqual({
        background: 'linear-gradient(to right, #000, #fff)',
      })
    })

    it('handles multiple colons in url', () => {
      expect(parseStyleAttr('background: url(https://example.com:8080/path/to/image.png)')).toEqual({
        background: 'url(https://example.com:8080/path/to/image.png)',
      })
    })
  })

  describe('stripGradientColorSpace', () => {
    // Same regex as css-utils.ts
    const GRADIENT_COLOR_SPACE_RE = /\s+in\s+(?:oklab|oklch|srgb(?:-linear)?|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz(?:-d(?:50|65))?|hsl|hwb|lab|lch)/g
    function stripGradientColorSpace(value: string): string {
      return value.replace(GRADIENT_COLOR_SPACE_RE, '')
    }

    it('strips "in oklab" from TW4 gradient', () => {
      expect(stripGradientColorSpace(
        'linear-gradient(to top right in oklab, #3b82f6 0%, rgba(0, 0, 0, 0) 100%)',
      )).toBe(
        'linear-gradient(to top right, #3b82f6 0%, rgba(0, 0, 0, 0) 100%)',
      )
    })

    it('strips "in oklch" from gradient', () => {
      expect(stripGradientColorSpace(
        'linear-gradient(to right in oklch, red, blue)',
      )).toBe(
        'linear-gradient(to right, red, blue)',
      )
    })

    it('strips "in srgb-linear"', () => {
      expect(stripGradientColorSpace(
        'radial-gradient(circle in srgb-linear, #000, #fff)',
      )).toBe(
        'radial-gradient(circle, #000, #fff)',
      )
    })

    it('leaves gradients without color space untouched', () => {
      const value = 'linear-gradient(to right, #000, #fff)'
      expect(stripGradientColorSpace(value)).toBe(value)
    })
  })

  describe('camelCase', () => {
    it('converts basic kebab case', () => {
      expect(camelCase('font-size')).toBe('fontSize')
    })

    it('handles multiple hyphens', () => {
      expect(camelCase('border-top-left-radius')).toBe('borderTopLeftRadius')
    })

    it('handles single word', () => {
      expect(camelCase('color')).toBe('color')
    })

    it('handles webkit prefix', () => {
      expect(camelCase('-webkit-transform')).toBe('WebkitTransform')
    })
  })
})
