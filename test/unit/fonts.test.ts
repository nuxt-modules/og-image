import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import satori from 'satori'
import { describe, expect, it } from 'vitest'
import { extractCustomFontFamilies } from '../../src/build/css/css-utils'
import { fontKey, getStaticInterFonts, matchesFontRequirements, parseConfiguredLocalFonts, resolveFontFamilies } from '../../src/build/fonts'
import { selectFontSource } from '../../src/runtime/server/og-image/font-source'
import { buildSubsetFamilyChain, renameSubsetFonts } from '../../src/runtime/server/og-image/font-subsets'
import { codepointsIntersectRanges, extractCodepoints, parseUnicodeRange } from '../../src/runtime/server/og-image/unicode-range'

const TAKUMI_FORMATS = new Set(['ttf', 'woff2'] as const)
const SATORI_FORMATS = new Set(['ttf', 'otf', 'woff'] as const)

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
  const fontVars = {
    'font-sans': 'Inter, sans-serif',
    'font-serif': '\'Playfair Display\', Georgia, serif',
    'font-mono': '\'JetBrains Mono\', monospace',
  } satisfies Record<string, string>

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

describe('parseConfiguredLocalFonts', () => {
  it('resolves global local font families from public/fonts', () => {
    const rootDir = join(tmpdir(), `og-image-local-fonts-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const fontDir = join(rootDir, 'public/fonts/sofia-pro')

    try {
      mkdirSync(fontDir, { recursive: true })
      writeFileSync(join(fontDir, 'sofia-pro-soft-400.woff2'), '')
      writeFileSync(join(fontDir, 'sofia-pro-soft-400-italic.woff2'), '')
      writeFileSync(join(fontDir, 'sofia-pro-soft-700.woff2'), '')
      writeFileSync(join(fontDir, 'sofia-pro-soft-900.woff2'), '')

      const fonts = parseConfiguredLocalFonts({
        options: {
          rootDir,
          fonts: {
            families: [
              {
                name: 'sofia-pro-soft',
                provider: 'local',
                weights: [400, 700],
                styles: ['normal', 'italic'],
                global: true,
              },
            ],
          },
        },
      } as any)

      expect(fonts).toEqual([
        {
          family: 'sofia-pro-soft',
          src: '/fonts/sofia-pro/sofia-pro-soft-400.woff2',
          weight: 400,
          style: 'normal',
          satoriSrc: undefined,
        },
        {
          family: 'sofia-pro-soft',
          src: '/fonts/sofia-pro/sofia-pro-soft-400-italic.woff2',
          weight: 400,
          style: 'italic',
          satoriSrc: undefined,
        },
        {
          family: 'sofia-pro-soft',
          src: '/fonts/sofia-pro/sofia-pro-soft-700.woff2',
          weight: 700,
          style: 'normal',
          satoriSrc: undefined,
        },
      ])
    }
    finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it('ignores local font families that are not global', () => {
    const rootDir = join(tmpdir(), `og-image-local-fonts-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const fontDir = join(rootDir, 'public/fonts')

    try {
      mkdirSync(fontDir, { recursive: true })
      writeFileSync(join(fontDir, 'custom-font-400.woff2'), '')

      const fonts = parseConfiguredLocalFonts({
        options: {
          rootDir,
          fonts: {
            families: [
              { name: 'custom-font', provider: 'local', weights: [400] },
            ],
          },
        },
      } as any)

      expect(fonts).toEqual([])
    }
    finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it('does not treat providerless remote font families as local', () => {
    const rootDir = join(tmpdir(), `og-image-local-fonts-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const fontDir = join(rootDir, 'public/fonts')

    try {
      mkdirSync(fontDir, { recursive: true })
      writeFileSync(join(fontDir, 'nunito-sans-400.woff2'), '')

      const fonts = parseConfiguredLocalFonts({
        options: {
          rootDir,
          fonts: {
            families: [
              { name: 'Nunito Sans', weights: [400], global: true },
            ],
          },
        },
      } as any)

      expect(fonts).toEqual([])
    }
    finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })
})

describe('cJK subset codepoint filtering', () => {
  it('keeps only subsets intersecting template codepoints', () => {
    // 帖 = U+5E16, 的 = U+7684
    const codepoints = new Set([0x5E16, 0x7684])

    // Subset covering 帖
    expect(codepointsIntersectRanges(codepoints, [[0x5E16, 0x5E16]])).toBe(true)
    // Subset covering 的
    expect(codepointsIntersectRanges(codepoints, [[0x7684, 0x7684]])).toBe(true)
    // Latin subset (no CJK chars)
    expect(codepointsIntersectRanges(codepoints, [[0x0000, 0x00FF]])).toBe(false)
    // Different CJK range
    expect(codepointsIntersectRanges(codepoints, [[0x9000, 0x9FFF]])).toBe(false)
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

describe('extractCodepoints', () => {
  it('extracts from VNode string children', () => {
    const node = { type: 'div', props: { children: 'AB' } }
    const cp = extractCodepoints(node)
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
    const cp = extractCodepoints(node)
    expect(cp.has('H'.codePointAt(0)!)).toBe(true)
    expect(cp.has('W'.codePointAt(0)!)).toBe(true)
  })

  it('handles null children in array', () => {
    const node = { type: 'div', props: { children: [null, 'A'] } }
    const cp = extractCodepoints(node)
    expect(cp.has(0x41)).toBe(true)
  })

  it('handles node with no children', () => {
    const node = { type: 'div', props: {} }
    const cp = extractCodepoints(node)
    expect(cp.size).toBe(0)
  })

  it('extracts surrogate pair codepoints', () => {
    const node = { type: 'div', props: { children: '\u{1F600}' } } // 😀
    const cp = extractCodepoints(node)
    expect(cp.has(0x1F600)).toBe(true)
  })

  it('extracts from takumi text field', () => {
    const node = { text: 'AB' }
    const cp = extractCodepoints(node)
    expect(cp.has(0x41)).toBe(true)
    expect(cp.has(0x42)).toBe(true)
  })

  it('extracts from takumi nested children', () => {
    const node = {
      children: [
        { text: 'Hello' },
        { children: [{ text: 'World' }] },
      ],
    }
    const cp = extractCodepoints(node)
    expect(cp.has('H'.codePointAt(0)!)).toBe(true)
    expect(cp.has('W'.codePointAt(0)!)).toBe(true)
  })

  it('handles node with no text or children', () => {
    const node = {}
    const cp = extractCodepoints(node)
    expect(cp.size).toBe(0)
  })
})

describe('renameSubsetFonts', () => {
  function makeFontConfig(overrides: Partial<{ family: string, weight: number, style: string, src: string, localPath: string, cacheKey: string, data: ArrayBuffer, unicodeRange: string }>): any {
    return {
      family: 'Inter',
      weight: 400,
      style: 'normal',
      src: '/test.woff2',
      localPath: '/test.woff2',
      cacheKey: 'default-key',
      data: new ArrayBuffer(8),
      ...overrides,
    }
  }

  it('does not rename when each family/weight/style has only one font', () => {
    const fonts = [
      makeFontConfig({ family: 'Inter', cacheKey: 'inter-400' }),
      makeFontConfig({ family: 'Inter', weight: 700, cacheKey: 'inter-700' }),
    ]
    const result = renameSubsetFonts(fonts)
    expect(result).toHaveLength(2)
    expect(result[0].family).toBe('Inter')
    expect(result[1].family).toBe('Inter')
    expect(result[0].originalFamily).toBeUndefined()
  })

  it('renames subset fonts with unique suffixes', () => {
    const fonts = [
      makeFontConfig({ family: 'Noto Sans SC', src: '/chunk-0.woff2', cacheKey: 'noto-chunk0', data: new ArrayBuffer(10) }),
      makeFontConfig({ family: 'Noto Sans SC', src: '/chunk-1.woff2', cacheKey: 'noto-chunk1', data: new ArrayBuffer(20) }),
      makeFontConfig({ family: 'Noto Sans SC', src: '/chunk-2.woff2', cacheKey: 'noto-chunk2', data: new ArrayBuffer(30) }),
    ]
    const result = renameSubsetFonts(fonts)
    expect(result).toHaveLength(3)
    const names = result.map(f => f.family)
    expect(new Set(names).size).toBe(3)
    for (const name of names)
      expect(name.startsWith('Noto Sans SC__')).toBe(true)
    // All preserve original family name
    expect(result[0].originalFamily).toBe('Noto Sans SC')
    expect(result[1].originalFamily).toBe('Noto Sans SC')
    expect(result[2].originalFamily).toBe('Noto Sans SC')
  })

  it('gives the same subset binary the same name across renders with different filtered lists', () => {
    // Render 1's codepoint filter keeps subsets A and B; B lands at index 1
    const renderA = [
      makeFontConfig({ family: 'Noto Sans SC', src: '/chunk-a.woff2', cacheKey: 'noto-a', data: new ArrayBuffer(10) }),
      makeFontConfig({ family: 'Noto Sans SC', src: '/chunk-b.woff2', cacheKey: 'noto-b', data: new ArrayBuffer(20) }),
    ]
    // Render 2's codepoint filter keeps subsets B and C; B now lands at index 0
    const renderB = [
      makeFontConfig({ family: 'Noto Sans SC', src: '/chunk-b.woff2', cacheKey: 'noto-b', data: new ArrayBuffer(20) }),
      makeFontConfig({ family: 'Noto Sans SC', src: '/chunk-c.woff2', cacheKey: 'noto-c', data: new ArrayBuffer(30) }),
    ]
    const a = renameSubsetFonts(renderA)
    const b = renameSubsetFonts(renderB)
    // Renderers keep the first registration per family name, so a name that
    // flips binaries between renders renders stale glyphs as .notdef
    expect(b[0].family).toBe(a[1].family)
  })

  it('renames a singleton subset font so its name stays bound to its binary', () => {
    // The codepoint filter can leave exactly one subset loaded per render.
    // Renderers keep the first registration per family name, so a bare name
    // that flips binaries between renders renders stale glyphs as .notdef
    const renderA = [
      makeFontConfig({ family: 'Noto Sans SC', src: '/chunk-a.woff2', cacheKey: 'noto-a', unicodeRange: 'U+4E00-4EFF', data: new ArrayBuffer(10) }),
    ]
    const renderB = [
      makeFontConfig({ family: 'Noto Sans SC', src: '/chunk-b.woff2', cacheKey: 'noto-b', unicodeRange: 'U+4F00-4FFF', data: new ArrayBuffer(20) }),
    ]
    const a1 = renameSubsetFonts(renderA)
    const b1 = renameSubsetFonts(renderB)
    expect(a1[0].family).not.toBe('Noto Sans SC')
    expect(a1[0].family).not.toBe(b1[0].family)
    expect(a1[0].originalFamily).toBe('Noto Sans SC')
    expect(b1[0].originalFamily).toBe('Noto Sans SC')
    // Repeat renders keep the same name per binary
    expect(renameSubsetFonts(renderA)[0].family).toBe(a1[0].family)
    expect(renameSubsetFonts(renderB)[0].family).toBe(b1[0].family)
  })

  it.each([undefined, ''])('keeps cache-key subset names stable when source paths are %s', (path) => {
    const fonts = ['a', 'b', 'c'].map(key => makeFontConfig({
      family: 'Noto Sans SC',
      src: path,
      localPath: path,
      cacheKey: `noto-${key}`,
      unicodeRange: 'U+4E00-4EFF',
    }))
    const singletonNames = fonts.map(font => renameSubsetFonts([font])[0].family)
    const filteredNames = renameSubsetFonts([fonts[2], fonts[0]]).map(font => font.family)

    expect(new Set(singletonNames).size).toBe(3)
    expect(filteredNames).toEqual([singletonNames[2], singletonNames[0]])
  })

  it('uses the local path when the source is empty', () => {
    const fonts = ['a', 'b'].map(key => makeFontConfig({
      src: '',
      localPath: `/chunk-${key}.woff2`,
      unicodeRange: 'U+4E00-4EFF',
    }))
    const names = renameSubsetFonts(fonts).map(font => font.family)

    expect(names[0]).not.toBe(names[1])
    expect(renameSubsetFonts([fonts[1]])[0].family).toBe(names[1])
  })

  it('keeps the source identity when local paths or cache keys change', () => {
    const font = makeFontConfig({ unicodeRange: 'U+4E00-4EFF' })
    const renamed = renameSubsetFonts([font])[0]
    const relocated = renameSubsetFonts([{ ...font, localPath: '/another.woff2', cacheKey: 'another-key' }])[0]

    expect(relocated.family).toBe(renamed.family)
  })

  it('keeps cached face registrations bound to their source across filtered renders', () => {
    const fonts = ['a', 'b', 'c'].flatMap(subset => [400, 700].map(weight => makeFontConfig({
      src: `/${subset}-${weight}.ttf`,
      cacheKey: `${subset}-${weight}`,
      weight,
      unicodeRange: 'U+0000-00FF',
    })))
    const registered = new Map<string, string>()
    // Filtering changes which regular and bold subsets share a fallback slot.
    for (const selection of [[0, 1, 2, 3], [2, 3, 4, 5], [0, 3, 4, 5]]) {
      for (const font of renameSubsetFonts(selection.map(index => fonts[index]!))) {
        const key = `${font.family}:${font.weight}:${font.style}`
        if (registered.has(key))
          expect(font.src).toBe(registered.get(key))
        else
          registered.set(key, font.src!)
      }
    }
  })

  it('changes shared aliases when a registered face changes', () => {
    const regular = makeFontConfig({ src: '/regular.ttf', unicodeRange: 'U+0000-00FF' })
    const bold = makeFontConfig({ src: '/bold.ttf', weight: 700, unicodeRange: 'U+0000-00FF' })
    const initial = renameSubsetFonts([regular, bold])
    const reordered = renameSubsetFonts([bold, regular])
    const replaced = renameSubsetFonts([regular, { ...bold, src: '/replacement-bold.ttf' }])

    expect(initial[0].family).toBe(initial[1].family)
    expect(reordered.map(font => font.family)).toEqual(initial.map(font => font.family))
    expect(replaced[0].family).not.toBe(initial[0].family)
    expect(replaced[0].family).toBe(replaced[1].family)
  })

  it.each([
    { completeBold: false, multipleSubsets: false, italic: false },
    { completeBold: true, multipleSubsets: false, italic: false },
    { completeBold: false, multipleSubsets: true, italic: false },
    { completeBold: false, multipleSubsets: false, italic: true },
  ])('preserves face matching across subsets: %j', async ({ completeBold, multipleSubsets, italic }) => {
    const fonts = [
      makeFontConfig({
        src: '/regular.ttf',
        unicodeRange: 'U+0000-00FF',
        data: readFileSync(new URL('../fixtures/multi-font-families/public/fonts/LocalSans-Regular.ttf', import.meta.url)),
      }),
      makeFontConfig({
        weight: italic ? 400 : 700,
        style: italic ? 'italic' : 'normal',
        src: '/bold.ttf',
        unicodeRange: completeBold ? undefined : 'U+0000-00FF',
        data: readFileSync(new URL('../fixtures/multi-font-families/public/fonts/LocalSans-Bold.ttf', import.meta.url)),
      }),
    ]
    // Distinct fixture outlines expose incorrect face selection, including style matching.
    if (multipleSubsets) {
      fonts.push(...fonts.map(font => ({
        ...font,
        src: `/second${font.src}`,
        unicodeRange: 'U+0100-017F',
      })))
    }
    for (const order of [fonts, [...fonts].reverse()]) {
      const renamed = renameSubsetFonts(order)
      const family = buildSubsetFamilyChain(renamed).get('Inter')!.join(', ')
      for (const face of fonts.slice(0, 2)) {
        const render = (fontFamily: string, entries: typeof renamed) => satori({
          type: 'div',
          props: { style: { fontFamily, fontWeight: face.weight, fontStyle: face.style, fontSize: 40 }, children: 'Hello World' },
        }, {
          width: 400,
          height: 100,
          fonts: entries.map(font => ({ name: font.family, data: font.data, weight: font.weight, style: font.style })) as any,
        })
        const actual = await render(family, renamed)
        const expected = await render('Inter', [face])
        expect(actual).toBe(expected)
      }
    }
  })

  it('does not rename when all fonts in a group have the same cacheKey', () => {
    // This happens when fontless provides the same static font for all subsets
    const fonts = [
      makeFontConfig({ family: 'Noto Sans SC', cacheKey: 'same-key' }),
      makeFontConfig({ family: 'Noto Sans SC', cacheKey: 'same-key' }),
    ]
    const result = renameSubsetFonts(fonts)
    expect(result).toHaveLength(2)
    expect(result[0].family).toBe('Noto Sans SC')
    expect(result[0].originalFamily).toBeUndefined()
  })

  it('only renames the group that has multiple distinct fonts', () => {
    const fonts = [
      makeFontConfig({ family: 'Inter', cacheKey: 'inter-400' }),
      makeFontConfig({ family: 'Noto Sans SC', src: '/noto-0.woff2', cacheKey: 'noto-0' }),
      makeFontConfig({ family: 'Noto Sans SC', src: '/noto-1.woff2', cacheKey: 'noto-1' }),
    ]
    const result = renameSubsetFonts(fonts)
    expect(result).toHaveLength(3)
    // Inter stays the same
    expect(result[0].family).toBe('Inter')
    expect(result[0].originalFamily).toBeUndefined()
    // Noto gets renamed
    expect(result[1].family.startsWith('Noto Sans SC__')).toBe(true)
    expect(result[2].family.startsWith('Noto Sans SC__')).toBe(true)
    expect(result[1].family).not.toBe(result[2].family)
  })
})

describe('buildSubsetFamilyChain', () => {
  it('builds chain from renamed fonts', () => {
    const fonts = [
      { family: 'Noto Sans SC__0', originalFamily: 'Noto Sans SC' },
      { family: 'Noto Sans SC__1', originalFamily: 'Noto Sans SC' },
      { family: 'Inter', originalFamily: undefined },
    ] as any[]
    const chains = buildSubsetFamilyChain(fonts)
    expect(chains.size).toBe(1)
    expect(chains.get('Noto Sans SC')).toEqual(['Noto Sans SC__0', 'Noto Sans SC__1'])
  })

  it('returns empty map when no fonts are renamed', () => {
    const fonts = [
      { family: 'Inter', originalFamily: undefined },
    ] as any[]
    const chains = buildSubsetFamilyChain(fonts)
    expect(chains.size).toBe(0)
  })
})

describe('selectFontSource', () => {
  it('uses primary WOFF2 for Takumi when a static alternative exists', () => {
    const result = selectFontSource(
      { src: '/_fonts/devanagari.woff2', satoriSrc: '/_og-static-fonts/Noto_Sans_Devanagari-400-normal.ttf' },
      TAKUMI_FORMATS,
    )
    expect(result).toEqual({ src: '/_fonts/devanagari.woff2', isStaticFallback: false })
  })

  it('uses primary WOFF2 for takumi when no satoriSrc exists', () => {
    const result = selectFontSource({ src: '/_fonts/inter.woff2' }, TAKUMI_FORMATS)
    expect(result).toEqual({ src: '/_fonts/inter.woff2', isStaticFallback: false })
  })

  it('does not flag as static fallback when satoriSrc equals src (same TTF for both)', () => {
    const result = selectFontSource(
      { src: '/_og-static-fonts/inter.ttf', satoriSrc: '/_og-static-fonts/inter.ttf' },
      TAKUMI_FORMATS,
    )
    expect(result).toEqual({ src: '/_og-static-fonts/inter.ttf', isStaticFallback: false })
  })

  it('falls back to satoriSrc for satori when primary is WOFF2 (unsupported)', () => {
    const result = selectFontSource(
      { src: '/_fonts/inter.woff2', satoriSrc: '/_og-static-fonts/inter.ttf' },
      SATORI_FORMATS,
    )
    expect(result).toEqual({ src: '/_og-static-fonts/inter.ttf', isStaticFallback: true })
  })

  it('returns null when no supported src is available (satori + WOFF2 only)', () => {
    const result = selectFontSource({ src: '/_fonts/inter.woff2' }, SATORI_FORMATS)
    expect(result).toBeNull()
  })
})
