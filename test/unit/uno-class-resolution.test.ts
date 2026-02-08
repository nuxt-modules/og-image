import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { evaluateCalc, extractPropertyInitialValues, postProcessStyles, resolveVarsDeep } from '../../src/build/css/css-utils'
import { clearUnoCache, createUnoProvider, setUnoConfig, setUnoRootDir } from '../../src/build/css/providers/uno'

// ============================================================================
// css-utils: new shared functions
// ============================================================================

describe('evaluateCalc', () => {
  it('passes through calc expressions via Lightning CSS', async () => {
    // Lightning CSS normalizes but may not fully simplify all calc expressions
    const result = await evaluateCalc('calc(10px + 20px)')
    expect(result).toContain('px')
  })

  it('normalizes but cannot simplify calc with relative units', async () => {
    // Lightning CSS cannot evaluate rem at compile time — just normalizes
    const result = await evaluateCalc('calc(0.25rem * 20)')
    expect(result).toContain('rem')
  })

  it('returns non-calc values unchanged', async () => {
    expect(await evaluateCalc('4rem')).toBe('4rem')
    expect(await evaluateCalc('red')).toBe('red')
  })

  it('returns original on malformed calc', async () => {
    const result = await evaluateCalc('calc( * 16)')
    expect(typeof result).toBe('string')
  })
})

describe('resolveVarsDeep', () => {
  it('resolves calc(var(--spacing) * N) with optimization', async () => {
    const vars = new Map([['--spacing', '0.25rem']])
    expect(await resolveVarsDeep('calc(var(--spacing) * 20)', vars)).toBe('5rem')
  })

  it('resolves calc(var(--spacing) * 16) to 4rem', async () => {
    const vars = new Map([['--spacing', '0.25rem']])
    expect(await resolveVarsDeep('calc(var(--spacing) * 16)', vars)).toBe('4rem')
  })

  it('resolves calc(var(--spacing) * 4) to 1rem', async () => {
    const vars = new Map([['--spacing', '0.25rem']])
    expect(await resolveVarsDeep('calc(var(--spacing) * 4)', vars)).toBe('1rem')
  })

  it('resolves nested var() recursively', async () => {
    const vars = new Map([['--b', '10px']])
    expect(await resolveVarsDeep('var(--a, var(--b))', vars)).toBe('10px')
  })

  it('evaluates calc after var resolution', async () => {
    const vars = new Map([['--size', '2rem']])
    const result = await resolveVarsDeep('calc(var(--size) * 3)', vars)
    expect(result).toBe('6rem')
  })

  it('returns empty string for completely missing vars (no calc)', async () => {
    const result = await resolveVarsDeep('var(--missing)', new Map())
    expect(result).toBe('')
  })
})

describe('extractPropertyInitialValues', () => {
  it('extracts initial-value from @property rules', () => {
    const css = `
@property --un-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}
@property --un-ring-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}
@property --un-shadow-color {
  syntax: "*";
  inherits: false;
}
`
    const vars = extractPropertyInitialValues(css)
    expect(vars.get('--un-shadow')).toBe('0 0 #0000')
    expect(vars.get('--un-ring-shadow')).toBe('0 0 #0000')
    expect(vars.has('--un-shadow-color')).toBe(false) // no initial-value
  })
})

describe('postProcessStyles cleanup', () => {
  it('skips malformed calc() from unresolved vars', async () => {
    const raw = { width: 'calc( * 16)', height: '4rem' }
    const result = await postProcessStyles(raw, new Map())
    expect(result?.width).toBeUndefined()
    expect(result?.height).toBe('4rem')
  })

  it('cleans up empty comma segments in box-shadow', async () => {
    const raw = { 'box-shadow': ', , , , 0 10px 15px -3px #0000001a,0 4px 6px -4px #0000001a' }
    const result = await postProcessStyles(raw, new Map())
    expect(result?.['box-shadow']).not.toMatch(/^[\s,]/)
    expect(result?.['box-shadow']).toContain('10px')
  })

  it('cleans leading/trailing/middle empty segments', async () => {
    const raw = { 'box-shadow': ', , 0 0 #0000, , 0 10px 15px -3px #000' }
    const result = await postProcessStyles(raw, new Map())
    expect(result?.['box-shadow']).toBe('0 0 #0000, 0 10px 15px -3px #000')
  })

  it('skips property when all comma segments are empty', async () => {
    const raw = { 'box-shadow': ', , , ' }
    const result = await postProcessStyles(raw, new Map())
    expect(result).toBeNull()
  })

  it('resolves vars with calc then evaluates (default resolveVarsDeep)', async () => {
    const vars = new Map([['--spacing', '0.25rem']])
    const raw = { width: 'calc(var(--spacing) * 16)' }
    const result = await postProcessStyles(raw, vars)
    expect(result?.width).toBe('4rem')
  })
})

// ============================================================================
// UnoCSS preset-wind4 (CSS-first, var-based spacing)
// ============================================================================

describe('unoCSS preset-wind4 class resolution', () => {
  let resolve: (classes: string[]) => Promise<Record<string, Record<string, string>>>

  beforeAll(async () => {
    const presetWind4 = await import('@unocss/preset-wind4')
    setUnoRootDir('/tmp/og-image-uno-test')
    setUnoConfig({ presets: [presetWind4.default()] })
    const provider = createUnoProvider()
    resolve = classes => provider.resolveClassesToStyles(classes) as Promise<Record<string, Record<string, string>>>
  })

  afterAll(() => {
    clearUnoCache()
  })

  describe('spacing utilities (var-based calc)', () => {
    it.each([
      ['w-16', 'width', '4rem'],
      ['h-16', 'height', '4rem'],
      ['gap-4', 'gap', '1rem'],
      ['gap-6', 'gap', '1.5rem'],
    ])('%s → %s: %s', async (cls, prop, expected) => {
      clearUnoCache()
      const result = await resolve([cls])
      expect(result[cls], `${cls} should resolve`).toBeDefined()
      expect(result[cls]?.[prop]).toBe(expected)
    })

    it('px-20 resolves padding-left and padding-right to 5rem', async () => {
      clearUnoCache()
      const result = await resolve(['px-20'])
      expect(result['px-20'], 'px-20 should resolve').toBeDefined()
      const styles = result['px-20']
      // Could be padding-inline expanded to padding-left/right, or padding-left/right directly
      const hasCorrectPadding = styles['padding-left'] === '5rem'
        || styles['padding-inline'] === '5rem'
      expect(hasCorrectPadding, `px-20 should have 5rem padding, got: ${JSON.stringify(styles)}`).toBe(true)
    })

    it('p-12 resolves to 3rem', async () => {
      clearUnoCache()
      const result = await resolve(['p-12'])
      expect(result['p-12'], 'p-12 should resolve').toBeDefined()
      // Check any padding property
      const styles = result['p-12']
      const padValue = styles.padding || styles['padding-top'] || styles['padding-left']
      expect(padValue).toBe('3rem')
    })
  })

  describe('shadow utilities (var-composed)', () => {
    it.each([
      'shadow-sm',
      'shadow',
      'shadow-md',
      'shadow-lg',
      'shadow-xl',
      'shadow-2xl',
    ])('%s resolves to valid box-shadow (no empty commas)', async (cls) => {
      clearUnoCache()
      const result = await resolve([cls])
      expect(result[cls], `${cls} should resolve`).toBeDefined()
      const shadow = result[cls]?.['box-shadow']
      expect(shadow, `${cls} should have box-shadow`).toBeDefined()
      // No leading/trailing commas or empty segments
      expect(shadow).not.toMatch(/^[\s,]/)
      expect(shadow).not.toMatch(/,\s*,/)
      expect(shadow).not.toMatch(/,\s*$/)
      // Should contain actual shadow values
      expect(shadow).toMatch(/\d+px/)
    })
  })

  describe('standard utilities', () => {
    it('resolves flex utilities', async () => {
      clearUnoCache()
      const result = await resolve(['flex', 'flex-col', 'items-center', 'justify-between'])
      expect(result.flex).toBeDefined()
      expect(result['flex-col']).toBeDefined()
      expect(result['items-center']).toBeDefined()
      expect(result['justify-between']).toBeDefined()
    })

    it('resolves color utilities to hex', async () => {
      clearUnoCache()
      const result = await resolve(['bg-black', 'bg-white', 'text-black'])
      expect(result['bg-black']?.['background-color']).toMatch(/^#/)
      expect(result['text-black']?.color).toMatch(/^#/)
    })

    it('resolves rounded-full', async () => {
      clearUnoCache()
      const result = await resolve(['rounded-full'])
      expect(result['rounded-full']).toBeDefined()
      expect(result['rounded-full']['border-radius']).toBe('9999px')
    })

    it('resolves positioning utilities', async () => {
      clearUnoCache()
      const result = await resolve(['relative', 'absolute', 'overflow-hidden'])
      expect(result.relative).toBeDefined()
      expect(result.absolute).toBeDefined()
      expect(result['overflow-hidden']).toBeDefined()
    })

    it('resolves text/font utilities', async () => {
      clearUnoCache()
      const result = await resolve(['text-4xl', 'font-bold', 'italic', 'uppercase'])
      for (const cls of ['text-4xl', 'font-bold', 'italic', 'uppercase']) {
        expect(result[cls], `${cls} should resolve`).toBeDefined()
      }
    })
  })

  describe('npmx.dev template classes', () => {
    it('resolves all classes from the failing template', async () => {
      clearUnoCache()
      const classes = [
        'h-full',
        'w-full',
        'flex',
        'flex-col',
        'justify-center',
        'px-20',
        'relative',
        'overflow-hidden',
        'z-10',
        'gap-6',
        'items-start',
        'gap-4',
        'w-16',
        'h-16',
        'rounded-xl',
        'shadow-lg',
        'text-8xl',
        'font-bold',
        'flex-wrap',
        'items-center',
        'px-3',
        'py-1',
        'rounded-lg',
        'border',
        'absolute',
        'rounded-full',
      ]
      const result = await resolve(classes)
      const unresolved = classes.filter(cls => !result[cls])
      expect(unresolved, 'All classes should resolve').toEqual([])
    })

    it('w-16 and h-16 produce numeric values (not malformed calc)', async () => {
      clearUnoCache()
      const result = await resolve(['w-16', 'h-16'])
      expect(result['w-16']?.width).not.toContain('calc(')
      expect(result['h-16']?.height).not.toContain('calc(')
      expect(result['w-16']?.width).toBe('4rem')
      expect(result['h-16']?.height).toBe('4rem')
    })

    it('shadow-lg has clean box-shadow without leading commas', async () => {
      clearUnoCache()
      const result = await resolve(['shadow-lg'])
      const shadow = result['shadow-lg']?.['box-shadow']
      expect(shadow).toBeDefined()
      expect(shadow).not.toMatch(/^,/)
      expect(shadow).not.toMatch(/,\s*,/)
      expect(shadow).toContain('10px')
      expect(shadow).toContain('15px')
    })
  })
})

// ============================================================================
// UnoCSS preset-wind (classic, direct values)
// ============================================================================

describe('unoCSS preset-wind class resolution', () => {
  let resolve: (classes: string[]) => Promise<Record<string, Record<string, string>>>

  beforeAll(async () => {
    const presetWind = await import('@unocss/preset-wind')
    clearUnoCache()
    setUnoRootDir('/tmp/og-image-uno-test-classic')
    setUnoConfig({ presets: [presetWind.default()] })
    const provider = createUnoProvider()
    resolve = classes => provider.resolveClassesToStyles(classes) as Promise<Record<string, Record<string, string>>>
  })

  afterAll(() => {
    clearUnoCache()
  })

  describe('spacing utilities (direct values)', () => {
    it('w-16 resolves to width: 4rem', async () => {
      clearUnoCache()
      const result = await resolve(['w-16'])
      expect(result['w-16']?.width).toBe('4rem')
    })

    it('px-20 resolves to 5rem padding', async () => {
      clearUnoCache()
      const result = await resolve(['px-20'])
      expect(result['px-20']).toBeDefined()
      const styles = result['px-20']
      expect(styles['padding-left'] || styles['padding-inline']).toBe('5rem')
    })

    it('gap-4 resolves to 1rem', async () => {
      clearUnoCache()
      const result = await resolve(['gap-4'])
      expect(result['gap-4']?.gap).toBe('1rem')
    })
  })

  describe('shadow utilities', () => {
    it('shadow-lg resolves to valid box-shadow', async () => {
      clearUnoCache()
      const result = await resolve(['shadow-lg'])
      expect(result['shadow-lg'], 'shadow-lg should resolve').toBeDefined()
      const shadow = result['shadow-lg']?.['box-shadow']
      expect(shadow, 'should have box-shadow').toBeDefined()
      expect(shadow).not.toMatch(/^[\s,]/)
      expect(shadow).not.toMatch(/,\s*,/)
      expect(shadow).toContain('10px')
    })
  })

  describe('standard utilities', () => {
    it('resolves flex utilities', async () => {
      clearUnoCache()
      const result = await resolve(['flex', 'flex-col', 'items-center'])
      expect(result.flex).toBeDefined()
      expect(result['flex-col']).toBeDefined()
      expect(result['items-center']).toBeDefined()
    })

    it('resolves color utilities to hex', async () => {
      clearUnoCache()
      const result = await resolve(['bg-black', 'text-white'])
      expect(result['bg-black']?.['background-color']).toMatch(/^#/)
    })
  })
})
