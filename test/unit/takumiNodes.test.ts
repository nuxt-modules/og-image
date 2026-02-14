import { describe, expect, it } from 'vitest'
import { resolveUnsupportedUnits } from '../../src/runtime/server/og-image/utils/css'

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

  describe('resolveUnsupportedUnits', () => {
    it('converts cqw to pixels using container width', () => {
      expect(resolveUnsupportedUnits('50cqw', 1200, 630)).toBe('600px')
    })

    it('converts cqh to pixels using container height', () => {
      expect(resolveUnsupportedUnits('50cqh', 1200, 630)).toBe('315px')
    })

    it('uses default 1200x630 when no dimensions provided', () => {
      expect(resolveUnsupportedUnits('100cqw')).toBe('1200px')
      expect(resolveUnsupportedUnits('100cqh')).toBe('630px')
    })

    it('handles cqi (inline) as width-relative', () => {
      expect(resolveUnsupportedUnits('50cqi', 800, 400)).toBe('400px')
    })

    it('handles cqb (block) as height-relative', () => {
      expect(resolveUnsupportedUnits('50cqb', 800, 400)).toBe('200px')
    })

    it('handles cqmin using smaller dimension', () => {
      expect(resolveUnsupportedUnits('100cqmin', 1200, 630)).toBe('630px')
    })

    it('handles cqmax using larger dimension', () => {
      expect(resolveUnsupportedUnits('100cqmax', 1200, 630)).toBe('1200px')
    })

    it('converts dynamic viewport units (dvw, dvh)', () => {
      expect(resolveUnsupportedUnits('50dvw', 1200, 630)).toBe('600px')
      expect(resolveUnsupportedUnits('50dvh', 1200, 630)).toBe('315px')
    })

    it('converts small viewport units (svw, svh)', () => {
      expect(resolveUnsupportedUnits('25svw', 1200, 630)).toBe('300px')
      expect(resolveUnsupportedUnits('25svh', 1200, 630)).toBe('157.5px')
    })

    it('converts large viewport units (lvw, lvh)', () => {
      expect(resolveUnsupportedUnits('10lvw', 1200, 630)).toBe('120px')
      expect(resolveUnsupportedUnits('10lvh', 1200, 630)).toBe('63px')
    })

    it('handles negative values', () => {
      expect(resolveUnsupportedUnits('-10cqw', 1200, 630)).toBe('-120px')
    })

    it('handles decimal values', () => {
      expect(resolveUnsupportedUnits('33.33cqw', 1200, 630)).toBe('399.96px')
    })

    it('passes through regular CSS values unchanged', () => {
      expect(resolveUnsupportedUnits('100px')).toBe('100px')
      expect(resolveUnsupportedUnits('50%')).toBe('50%')
      expect(resolveUnsupportedUnits('2rem')).toBe('2rem')
      expect(resolveUnsupportedUnits('red')).toBe('red')
    })

    it('handles mixed values with unsupported units', () => {
      expect(resolveUnsupportedUnits('calc(50cqw + 10px)', 1200, 630)).toBe('calc(600px + 10px)')
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

  describe('font-mono + text-8xl style merging', () => {
    it('parseStyleAttr preserves all properties from merged font-mono + text-8xl', () => {
      // This simulates the inline style that the build-time transform produces
      const style = 'font-family: \'Geist Mono\', monospace; font-size: 6rem; line-height: 1; letter-spacing: -.05em; margin-bottom: 1rem'
      const parsed = parseStyleAttr(style)
      expect(parsed).toBeDefined()
      expect(parsed!.fontFamily).toContain('Geist Mono')
      expect(parsed!.fontSize).toBe('6rem')
      expect(parsed!.lineHeight).toBe('1')
      expect(parsed!.letterSpacing).toBe('-.05em')
      expect(parsed!.marginBottom).toBe('1rem')
    })

    it('font-mono font-family does not clobber fontSize after camelCase conversion', () => {
      // Test that camelCase conversion doesn't merge font-family and font-size
      const style = 'font-family: monospace; font-size: 96px'
      const parsed = parseStyleAttr(style)
      expect(parsed!.fontFamily).toBe('monospace')
      expect(parsed!.fontSize).toBe('96px')
      // No "font" shorthand key should appear
      expect(parsed!.font).toBeUndefined()
    })

    it('resolveUnsupportedUnits preserves rem values (takumi handles rem natively)', () => {
      // Verify rem values pass through to takumi renderer
      expect(resolveUnsupportedUnits('6rem')).toBe('6rem')
      expect(resolveUnsupportedUnits('1rem')).toBe('1rem')
      expect(resolveUnsupportedUnits('-.05em')).toBe('-.05em')
    })
  })
})
