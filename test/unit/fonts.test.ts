import { describe, expect, it } from 'vitest'
import { extractCustomFontFamilies } from '../../src/build/css/css-utils'
import { extractFontFacesWithSubsets } from '../../src/build/css/font-face'
import { fontKey, getStaticInterFonts, matchesFontRequirements, resolveFontFamilies } from '../../src/build/fonts'
import { codepointsIntersectRanges, extractCodepointsFromTakumiNodes, extractCodepointsFromVNodes, parseUnicodeRange } from '../../src/runtime/server/og-image/unicode-range'

describe('extractCustomFontFamilies', () => {
  it('extracts unquoted family names', () => {
    expect(extractCustomFontFamilies('Inter')).toEqual(['Inter'])
  })

  it('extracts single-quoted names', () => {
    expect(extractCustomFontFamilies('\'Inter\'')).toEqual(['Inter'])
  })

  it('extracts double-quoted names', () => {
    expect(extractCustomFontFamilies('"Inter"')).toEqual(['Inter'])
  })

  it('extracts comma-separated families', () => {
    expect(extractCustomFontFamilies('Inter, Roboto')).toEqual(['Inter', 'Roboto'])
  })

  it('filters generic families', () => {
    expect(extractCustomFontFamilies('Inter, sans-serif')).toEqual(['Inter'])
    expect(extractCustomFontFamilies('serif')).toEqual([])
    expect(extractCustomFontFamilies('monospace')).toEqual([])
    expect(extractCustomFontFamilies('system-ui')).toEqual([])
  })

  it('filters vendor-prefixed system fonts', () => {
    expect(extractCustomFontFamilies('-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'))
      .toEqual(['Segoe UI', 'Roboto'])
    expect(extractCustomFontFamilies('-apple-system')).toEqual([])
    expect(extractCustomFontFamilies('BlinkMacSystemFont')).toEqual([])
  })

  it('filters CSS keywords', () => {
    expect(extractCustomFontFamilies('inherit')).toEqual([])
    expect(extractCustomFontFamilies('initial')).toEqual([])
    expect(extractCustomFontFamilies('unset')).toEqual([])
  })

  it('is case-insensitive for generic families', () => {
    expect(extractCustomFontFamilies('SANS-SERIF')).toEqual([])
    expect(extractCustomFontFamilies('Sans-Serif')).toEqual([])
  })

  it('returns empty for empty input', () => {
    expect(extractCustomFontFamilies('')).toEqual([])
  })

  it('handles mixed quoted and generic', () => {
    expect(extractCustomFontFamilies('\'Playfair Display\', \'Inter\', serif'))
      .toEqual(['Playfair Display', 'Inter'])
  })

  it('handles whitespace', () => {
    expect(extractCustomFontFamilies('  Inter  ,  Roboto  ')).toEqual(['Inter', 'Roboto'])
  })

  it('strips !important from value', () => {
    expect(extractCustomFontFamilies('\'Inter\' !important')).toEqual(['Inter'])
  })

  it('strips !important with multiple families', () => {
    expect(extractCustomFontFamilies('\'OptiEinstein\', \'Noto Sans\', sans-serif !important'))
      .toEqual(['OptiEinstein', 'Noto Sans'])
  })

  it('strips !important from unquoted value', () => {
    expect(extractCustomFontFamilies('Inter !important')).toEqual(['Inter'])
  })
})

describe('resolveFontFamilies', () => {
  const fontVars: Record<string, string> = {
    'font-sans': 'Inter, sans-serif',
    'font-serif': '\'Playfair Display\', Georgia, serif',
    'font-mono': '\'JetBrains Mono\', monospace',
  }

  it('returns empty when no classes or names', () => {
    expect(resolveFontFamilies([], [], fontVars)).toEqual([])
  })

  it('resolves class suffix via fontVars', () => {
    const result = resolveFontFamilies(['serif'], [], fontVars)
    expect(result).toContain('Playfair Display')
    expect(result).toContain('Georgia')
  })

  it('always includes font-sans default when filtering', () => {
    const result = resolveFontFamilies(['serif'], [], fontVars)
    expect(result).toContain('Inter')
  })

  it('includes directly referenced family names', () => {
    const result = resolveFontFamilies([], ['Lobster'], fontVars)
    expect(result).toContain('Lobster')
    expect(result).toContain('Inter') // font-sans default
  })

  it('deduplicates families', () => {
    const result = resolveFontFamilies(['sans'], ['Inter'], fontVars)
    const interCount = result.filter(f => f === 'Inter').length
    expect(interCount).toBe(1)
  })

  it('handles unknown class suffix gracefully', () => {
    const result = resolveFontFamilies(['fantasy-custom'], [], fontVars)
    // Only font-sans default
    expect(result).toEqual(['Inter'])
  })

  it('combines classes and names', () => {
    const result = resolveFontFamilies(['mono'], ['Lobster'], fontVars)
    expect(result).toContain('Inter') // font-sans default
    expect(result).toContain('JetBrains Mono') // from mono var
    expect(result).toContain('Lobster') // direct name
  })

  it('works without font-sans in vars', () => {
    const result = resolveFontFamilies(['serif'], [], { 'font-serif': 'Georgia, serif' })
    expect(result).toEqual(['Georgia'])
  })
})

describe('fontKey', () => {
  it('generates key from family, weight, style', () => {
    expect(fontKey({ family: 'Inter', weight: 400, style: 'normal' }))
      .toBe('Inter-400-normal-default')
  })

  it('includes unicode range when present', () => {
    expect(fontKey({ family: 'Inter', weight: 400, style: 'normal', unicodeRange: 'U+0-FF' }))
      .toBe('Inter-400-normal-U+0-FF')
  })

  it('uses "default" for missing unicode range', () => {
    expect(fontKey({ family: 'Inter', weight: 700, style: 'italic' }))
      .toBe('Inter-700-italic-default')
  })

  it('differentiates by weight', () => {
    const k1 = fontKey({ family: 'Inter', weight: 400, style: 'normal' })
    const k2 = fontKey({ family: 'Inter', weight: 700, style: 'normal' })
    expect(k1).not.toBe(k2)
  })
})

describe('matchesFontRequirements', () => {
  const req = { weights: [400, 700], styles: ['normal' as const, 'italic' as const], families: [] as string[] }

  it('matches when weight and style match', () => {
    expect(matchesFontRequirements({ weight: 400, style: 'normal', family: 'Inter' }, req)).toBe(true)
  })

  it('rejects unmatched weight', () => {
    expect(matchesFontRequirements({ weight: 300, style: 'normal', family: 'Inter' }, req)).toBe(false)
  })

  it('rejects unmatched style', () => {
    expect(matchesFontRequirements({ weight: 400, style: 'oblique', family: 'Inter' }, req)).toBe(false)
  })

  it('matches any family when families is empty', () => {
    expect(matchesFontRequirements({ weight: 400, style: 'normal', family: 'Anything' }, req)).toBe(true)
  })

  it('filters by family when families is set', () => {
    const reqWithFamilies = { ...req, families: ['Inter'] }
    expect(matchesFontRequirements({ weight: 400, style: 'normal', family: 'Inter' }, reqWithFamilies)).toBe(true)
    expect(matchesFontRequirements({ weight: 400, style: 'normal', family: 'Roboto' }, reqWithFamilies)).toBe(false)
  })
})

describe('getStaticInterFonts', () => {
  it('returns two Inter fonts at 400 and 700', () => {
    const fonts = getStaticInterFonts()
    expect(fonts).toHaveLength(2)
    expect(fonts[0].family).toBe('Inter')
    expect(fonts[0].weight).toBe(400)
    expect(fonts[0].satoriSrc).toBeDefined()
    expect(fonts[1].weight).toBe(700)
    expect(fonts[1].satoriSrc).toBeDefined()
  })
})

describe('extractFontFacesWithSubsets', () => {
  const multiSubsetCss = `
/* devanagari */
@font-face {
  font-family: 'Noto Sans';
  font-style: normal;
  font-weight: 400;
  src: url(/_fonts/noto-sans-devanagari-400.woff2) format('woff2');
  unicode-range: U+0900-097F;
}
/* latin */
@font-face {
  font-family: 'Noto Sans';
  font-style: normal;
  font-weight: 400;
  src: url(/_fonts/noto-sans-latin-400.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
`

  it('includes all subsets including non-latin', async () => {
    const fonts = await extractFontFacesWithSubsets(multiSubsetCss)
    expect(fonts).toHaveLength(2)
    expect(fonts.map(f => f.subset)).toContain('devanagari')
    expect(fonts.map(f => f.subset)).toContain('latin')
  })

  it('includes fonts without subset comments', async () => {
    const cssNoComment = `
@font-face {
  font-family: 'Custom';
  font-style: normal;
  font-weight: 400;
  src: url(/fonts/custom.woff2) format('woff2');
}
`
    const fonts = await extractFontFacesWithSubsets(cssNoComment)
    expect(fonts).toHaveLength(1)
    expect(fonts[0].subset).toBeUndefined()
  })
})

describe('parseUnicodeRange', () => {
  it('parses single codepoint', () => {
    expect(parseUnicodeRange('U+0041')).toEqual([[0x41, 0x41]])
  })

  it('parses range', () => {
    expect(parseUnicodeRange('U+0900-097F')).toEqual([[0x0900, 0x097F]])
  })

  it('parses multiple comma-separated ranges', () => {
    expect(parseUnicodeRange('U+0900-097F, U+0980-09FF')).toEqual([
      [0x0900, 0x097F],
      [0x0980, 0x09FF],
    ])
  })

  it('handles lowercase hex', () => {
    expect(parseUnicodeRange('U+0000-00ff')).toEqual([[0, 0xFF]])
  })

  it('returns null for invalid input', () => {
    expect(parseUnicodeRange('invalid')).toBeNull()
    expect(parseUnicodeRange('')).toBeNull()
  })
})

describe('codepointsIntersectRanges', () => {
  it('returns true when codepoint falls in range', () => {
    const codepoints = new Set([0x41]) // 'A'
    expect(codepointsIntersectRanges(codepoints, [[0x00, 0xFF]])).toBe(true)
  })

  it('returns false when no codepoint in range', () => {
    const codepoints = new Set([0x41]) // 'A' — latin
    expect(codepointsIntersectRanges(codepoints, [[0x0900, 0x097F]])).toBe(false) // devanagari
  })

  it('returns true for exact boundary match', () => {
    const codepoints = new Set([0x0900])
    expect(codepointsIntersectRanges(codepoints, [[0x0900, 0x097F]])).toBe(true)
  })

  it('returns false for empty codepoints', () => {
    expect(codepointsIntersectRanges(new Set(), [[0x00, 0xFF]])).toBe(false)
  })
})

describe('extractCodepointsFromVNodes', () => {
  it('extracts from string children', () => {
    const node = { type: 'div', props: { children: 'AB' } }
    const cp = extractCodepointsFromVNodes(node)
    expect(cp.has(0x41)).toBe(true) // A
    expect(cp.has(0x42)).toBe(true) // B
  })

  it('extracts from nested VNode array children', () => {
    const node = {
      type: 'div',
      props: {
        children: [
          'Hello',
          { type: 'span', props: { children: 'World' } },
        ],
      },
    }
    const cp = extractCodepointsFromVNodes(node)
    expect(cp.has('H'.codePointAt(0)!)).toBe(true)
    expect(cp.has('W'.codePointAt(0)!)).toBe(true)
  })

  it('handles null children in array', () => {
    const node = { type: 'div', props: { children: [null, 'A'] } }
    const cp = extractCodepointsFromVNodes(node)
    expect(cp.has(0x41)).toBe(true)
  })

  it('handles node with no children', () => {
    const node = { type: 'div', props: {} }
    const cp = extractCodepointsFromVNodes(node)
    expect(cp.size).toBe(0)
  })

  it('extracts surrogate pair codepoints', () => {
    const node = { type: 'div', props: { children: '\u{1F600}' } } // 😀
    const cp = extractCodepointsFromVNodes(node)
    expect(cp.has(0x1F600)).toBe(true)
  })
})

describe('extractCodepointsFromTakumiNodes', () => {
  it('extracts from text field', () => {
    const node = { text: 'AB' }
    const cp = extractCodepointsFromTakumiNodes(node)
    expect(cp.has(0x41)).toBe(true)
    expect(cp.has(0x42)).toBe(true)
  })

  it('extracts from nested children', () => {
    const node = {
      children: [
        { text: 'Hello' },
        { children: [{ text: 'World' }] },
      ],
    }
    const cp = extractCodepointsFromTakumiNodes(node)
    expect(cp.has('H'.codePointAt(0)!)).toBe(true)
    expect(cp.has('W'.codePointAt(0)!)).toBe(true)
  })

  it('handles node with no text or children', () => {
    const node = {}
    const cp = extractCodepointsFromTakumiNodes(node)
    expect(cp.size).toBe(0)
  })
})
