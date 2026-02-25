import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { evaluateCalc, extractCssVars, extractPropertyInitialValues, extractVarsFromCss, postProcessStyles, resolveExtractedVars, resolveVarsDeep } from '../../src/build/css/css-utils'
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

  it('preserves var() reference for completely missing vars (no calc)', async () => {
    const result = await resolveVarsDeep('var(--missing)', new Map())
    expect(result).toBe('var(--missing)')
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

describe('extractVarsFromCss (AST-based)', () => {
  it('splits vars into qualifiedRules from compound :root selectors', async () => {
    const css = `
:root:not([data-theme='light']), :root[data-theme='dark'] {
  --bg: oklch(0.171 0 0);
  --fg: oklch(0.982 0 0);
  --fg-muted: oklch(0.749 0 0);
}
:root[data-theme='light'] {
  --bg: oklch(1 0 0);
  --fg: oklch(0.146 0 0);
}
`
    const extracted = await extractVarsFromCss(css)
    // Should have qualified rules, not plain rootVars
    expect(extracted.qualifiedRules.length).toBeGreaterThan(0)
    expect(extracted.rootVars.size).toBe(0)
    // Dark mode resolution
    const dark = resolveExtractedVars(extracted, { 'data-theme': 'dark' })
    expect(dark.has('--bg')).toBe(true)
    expect(dark.has('--fg')).toBe(true)
    expect(dark.has('--fg-muted')).toBe(true)
    // Light mode resolution
    const light = resolveExtractedVars(extracted, { 'data-theme': 'light' })
    expect(light.has('--bg')).toBe(true)
    expect(light.has('--fg')).toBe(true)
  })

  it('resolves dark mode vars correctly', async () => {
    const css = `
:root { --base: 1; }
:root[data-theme='dark'] { --bg: black; --fg: white; }
:root[data-theme='light'] { --bg: white; --fg: black; }
`
    const extracted = await extractVarsFromCss(css)
    const dark = resolveExtractedVars(extracted, { 'data-theme': 'dark' })
    expect(dark.get('--base')).toBe('1')
    expect(dark.get('--bg')).toBe('black')
    expect(dark.get('--fg')).toBe('white')

    const light = resolveExtractedVars(extracted, { 'data-theme': 'light' })
    expect(light.get('--base')).toBe('1')
    expect(light.get('--bg')).toBe('white')
    expect(light.get('--fg')).toBe('black')
  })

  it('detects :root.dark and :root.light class selectors', async () => {
    const css = `
:root.dark { --bg: black; }
:root.light { --bg: white; }
`
    const extracted = await extractVarsFromCss(css)
    const dark = resolveExtractedVars(extracted, { 'data-theme': 'dark' })
    const light = resolveExtractedVars(extracted, { 'data-theme': 'light' })
    expect(dark.get('--bg')).toBe('black')
    expect(light.get('--bg')).toBe('white')
    expect(dark.get('--bg')).not.toBe(light.get('--bg'))
  })

  it('resolves compound selectors with multiple data-* attrs', async () => {
    const css = `
:root[data-theme='dark'] { --bg: oklch(0.171 0 0); }
:root[data-theme='dark'][data-bg-theme='slate'] { --bg: oklch(0.151 0.018 264); }
:root[data-theme='light'] { --bg: oklch(1 0 0); }
`
    const extracted = await extractVarsFromCss(css)
    // Dark + slate: compound rule should overlay base dark
    const darkSlate = resolveExtractedVars(extracted, { 'data-theme': 'dark', 'data-bg-theme': 'slate' })
    expect(darkSlate.get('--bg')).toMatch(/oklch\(0\.15\d*\s+0\.01\d*\s+264\)/)
    // Dark only: base dark rule
    const dark = resolveExtractedVars(extracted, { 'data-theme': 'dark' })
    expect(dark.get('--bg')).toMatch(/oklch\(0\.17\d*\s+0\s+0\)/)
    // Light: light rule
    const light = resolveExtractedVars(extracted, { 'data-theme': 'light' })
    expect(light.get('--bg')).toMatch(/oklch\(1\s+0\s+0\)/)
  })

  it('handles comma-separated :root selectors independently', async () => {
    // Real-world pattern: :root:not([data-theme='light']), :root[data-theme='dark'] { --bg: ... }
    // Each comma-separated selector should be its own qualified rule (OR, not AND)
    const css = `
:root:not([data-theme='light']),
:root[data-theme='dark'] {
  --bg: #0a0a0a;
  --fg: #fafafa;
}
:root[data-theme='dark'][data-bg-theme='zinc'] {
  --bg: #18181b;
}
`
    const extracted = await extractVarsFromCss(css)
    // With data-theme=dark + data-bg-theme=zinc, zinc compound rule should win for --bg
    const darkZinc = resolveExtractedVars(extracted, { 'data-theme': 'dark', 'data-bg-theme': 'zinc' })
    // lightningcss may convert hex to rgb
    expect(darkZinc.get('--bg')).toMatch(/(?:#18181b|rgb\(24, 24, 27\))/)
    expect(darkZinc.get('--fg')).toMatch(/(?:#fafafa|rgb\(250, 250, 250\))/)
    // Without bg-theme, base dark should apply
    const dark = resolveExtractedVars(extracted, { 'data-theme': 'dark' })
    expect(dark.get('--bg')).toMatch(/(?:#0a0a0a|rgb\(10, 10, 10\))/)
  })

  it('npmx.dev exact: var(--bg-color, oklch(...)) with zinc compound', async () => {
    const css = `
:root:not([data-theme='light']),
:root[data-theme='dark'] {
  --bg: var(--bg-color, oklch(0.171 0 0));
  --fg: oklch(0.982 0 0);
}
:root[data-theme='dark'][data-bg-theme='zinc'] {
  --bg: oklch(0.5147 0.2491 285.823);
}
`
    const extracted = await extractVarsFromCss(css)

    const darkZinc = resolveExtractedVars(extracted, { 'data-theme': 'dark', 'data-bg-theme': 'zinc' })
    // Zinc compound rule should win — NOT the base dark oklch(0.171 0 0)
    const bgVal = darkZinc.get('--bg')!
    expect(bgVal).not.toContain('0.171')
    expect(bgVal).toMatch(/oklch|0\.51/)
  })

  it('extracts vars from plain :root', async () => {
    const css = ':root { --color: red; --size: 16px; }'
    const { rootVars } = await extractVarsFromCss(css)
    expect(rootVars.get('--color')).toBe('red')
    expect(rootVars.get('--size')).toBe('16px')
  })

  it('extracts universal vars', async () => {
    const css = '*, ::before, ::after { --un-shadow: 0 0 transparent; }'
    const { universalVars } = await extractVarsFromCss(css)
    expect(universalVars.has('--un-shadow')).toBe(true)
  })

  it('extracts per-class vars', async () => {
    const css = '.shadow-lg { --un-shadow: 0 10px 15px -3px rgba(0,0,0,.1); }'
    const { perClassVars } = await extractVarsFromCss(css)
    expect(perClassVars.has('shadow-lg')).toBe(true)
    expect(perClassVars.get('shadow-lg')?.has('--un-shadow')).toBe(true)
  })

  it('regex handles compound :root selectors', () => {
    const css = `:root[data-theme='dark'] { --bg: black; }`
    const vars = extractCssVars(css)
    expect(vars.has('--bg')).toBe(true)
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

    it('font-mono does not reset text-8xl font-size', async () => {
      clearUnoCache()
      const result = await resolve(['font-mono', 'text-8xl', 'tracking-tighter', 'mb-4'])

      expect(result['font-mono'], 'font-mono should resolve').toBeDefined()
      expect(result['font-mono']?.['font-family'], 'font-mono should set font-family').toBeDefined()
      expect(result['font-mono']?.['font-size'], 'font-mono must NOT set font-size').toBeUndefined()
      expect(result['font-mono']?.font, 'font-mono must NOT produce font shorthand').toBeUndefined()

      expect(result['text-8xl'], 'text-8xl should resolve alongside font-mono').toBeDefined()
      expect(result['text-8xl']?.['font-size'], 'text-8xl should have font-size').toBeDefined()
    })

    it('font-mono combined with text sizes preserves font-size', async () => {
      for (const size of ['text-sm', 'text-lg', 'text-xl', 'text-4xl', 'text-8xl']) {
        clearUnoCache()
        const result = await resolve(['font-mono', size])
        expect(result[size], `${size} should resolve alongside font-mono`).toBeDefined()
        expect(result[size]?.['font-size'], `${size} should have font-size`).toBeDefined()
        expect(result['font-mono']?.['font-size'], `font-mono should not steal font-size from ${size}`).toBeUndefined()
      }
    })

    it('merged font-mono + text-8xl contains all properties', async () => {
      clearUnoCache()
      const result = await resolve(['font-mono', 'text-8xl', 'tracking-tighter', 'mb-4'])
      const merged: Record<string, string> = {}
      for (const cls of ['font-mono', 'text-8xl', 'tracking-tighter', 'mb-4']) {
        if (result[cls])
          Object.assign(merged, result[cls])
      }
      expect(merged['font-family'], 'merged should have font-family').toBeDefined()
      expect(merged['font-size'], 'merged should have font-size').toBeDefined()
      expect(merged['letter-spacing'], 'merged should have letter-spacing').toBeDefined()
      expect(merged['margin-bottom'], 'merged should have margin-bottom').toBeDefined()
      expect(merged.font, 'merged should NOT have font shorthand').toBeUndefined()
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

  // ==========================================================================
  // Responsive prefix preservation
  // ==========================================================================

  describe('responsive prefixed classes are preserved, not inlined', () => {
    // Use raw provider (not cast resolve) since responsive classes return strings
    let rawResolve: (classes: string[]) => Promise<Record<string, Record<string, string> | string>>

    beforeAll(async () => {
      const presetWind4 = await import('@unocss/preset-wind4')
      clearUnoCache()
      setUnoRootDir('/tmp/og-image-uno-test-responsive')
      setUnoConfig({ presets: [presetWind4.default()] })
      const provider = createUnoProvider()
      rawResolve = classes => provider.resolveClassesToStyles(classes)
    })

    afterAll(() => {
      clearUnoCache()
    })

    it('md:bg-blue-500 is returned as a string class rewrite, not inline styles', async () => {
      clearUnoCache()
      const result = await rawResolve(['bg-red-500', 'md:bg-blue-500'])
      // md:bg-blue-500 should be a string (class rewrite with prefix preserved)
      expect(typeof result['md:bg-blue-500']).toBe('string')
      expect(result['md:bg-blue-500'] as string).toMatch(/^md:bg-\[/)
      // bg-red-500 should also be a string (conflicting base class stays as class rewrite)
      expect(typeof result['bg-red-500']).toBe('string')
      expect(result['bg-red-500'] as string).toMatch(/^bg-\[/)
    })

    it('all responsive prefixes are preserved (sm, md, lg, xl, 2xl)', async () => {
      clearUnoCache()
      const result = await rawResolve(['hidden', 'sm:flex', 'md:flex', 'lg:flex', 'xl:flex', '2xl:flex'])
      for (const prefix of ['sm', 'md', 'lg', 'xl', '2xl']) {
        const val = result[`${prefix}:flex`]
        expect(val, `${prefix}:flex should be resolved`).toBeDefined()
        expect(typeof val, `${prefix}:flex should be a string`).toBe('string')
        expect(val as string).toMatch(new RegExp(`^${prefix}:`))
      }
    })

    it('base class that conflicts with responsive variant stays as class rewrite', async () => {
      clearUnoCache()
      const result = await rawResolve(['text-black', 'lg:text-white'])
      // Both should be string rewrites (not inlined), since they conflict
      expect(typeof result['text-black']).toBe('string')
      expect(typeof result['lg:text-white']).toBe('string')
      expect(result['lg:text-white'] as string).toMatch(/^lg:text-\[/)
    })

    it('non-conflicting classes are still inlined as styles', async () => {
      clearUnoCache()
      const result = await rawResolve(['flex', 'md:bg-blue-500'])
      // flex has no responsive conflict — should be inlined as styles
      expect(typeof result.flex).toBe('object')
      expect((result.flex as Record<string, string>).display).toBe('flex')
    })

    it('dark: prefixed classes are preserved as string rewrites', async () => {
      clearUnoCache()
      const result = await rawResolve(['bg-white', 'dark:bg-black'])
      expect(typeof result['dark:bg-black']).toBe('string')
      expect(result['dark:bg-black'] as string).toMatch(/^dark:bg-\[/)
      // bg-white conflicts — should also be a string
      expect(typeof result['bg-white']).toBe('string')
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

// ============================================================================
// UnoCSS preset-wind4 with custom theme (npmx.dev config)
// ============================================================================

describe('unoCSS preset-wind4 with custom font theme', () => {
  let resolve: (classes: string[]) => Promise<Record<string, Record<string, string>>>

  beforeAll(async () => {
    const presetWind4 = await import('@unocss/preset-wind4')
    clearUnoCache()
    setUnoRootDir('/tmp/og-image-uno-test-custom-font')
    setUnoConfig({
      presets: [presetWind4.default()],
      theme: {
        spacing: { DEFAULT: '4px' },
        font: {
          mono: '\'Geist Mono\', monospace',
          sans: '\'Geist\', system-ui, -apple-system, sans-serif',
        },
      },
    })
    const provider = createUnoProvider()
    resolve = classes => provider.resolveClassesToStyles(classes) as Promise<Record<string, Record<string, string>>>
  })

  afterAll(() => {
    clearUnoCache()
  })

  it('font-mono resolves to custom Geist Mono font-family', async () => {
    clearUnoCache()
    const result = await resolve(['font-mono'])
    expect(result['font-mono'], 'font-mono should resolve').toBeDefined()
    expect(result['font-mono']?.['font-family'], 'should have font-family').toBeDefined()
    expect(result['font-mono']?.['font-family']).toContain('Geist Mono')
    // Must NOT produce a font shorthand
    expect(result['font-mono']?.font, 'must NOT produce font shorthand').toBeUndefined()
    // Must NOT set font-size
    expect(result['font-mono']?.['font-size'], 'must NOT set font-size').toBeUndefined()
  })

  it('text-8xl resolves font-size with custom spacing', async () => {
    clearUnoCache()
    const result = await resolve(['text-8xl'])
    expect(result['text-8xl'], 'text-8xl should resolve').toBeDefined()
    expect(result['text-8xl']?.['font-size'], 'should have font-size').toBeDefined()
  })

  it('class order: font-mono BEFORE text-8xl resolves identically to AFTER', async () => {
    clearUnoCache()
    const orderA = await resolve(['font-mono', 'text-8xl', 'tracking-tighter', 'mb-4'])
    clearUnoCache()
    const orderB = await resolve(['text-8xl', 'font-mono', 'tracking-tighter', 'mb-4'])

    // Both orderings must produce identical results for each class
    for (const cls of ['font-mono', 'text-8xl', 'tracking-tighter', 'mb-4']) {
      expect(orderA[cls], `orderA ${cls} should resolve`).toBeDefined()
      expect(orderB[cls], `orderB ${cls} should resolve`).toBeDefined()
      expect(orderA[cls], `${cls} should be identical regardless of class order`).toEqual(orderB[cls])
    }
  })

  it('raw UnoCSS CSS: font-mono rule only sets font-family, not font shorthand', async () => {
    const { createGenerator } = await import('unocss')
    const presetWind4 = await import('@unocss/preset-wind4')

    const gen = await createGenerator({
      presets: [presetWind4.default()],
      theme: {
        spacing: { DEFAULT: '4px' },
        font: {
          mono: '\'Geist Mono\', monospace',
          sans: '\'Geist\', system-ui, -apple-system, sans-serif',
        },
      },
    })

    // Order A: font-mono first
    const { css: cssA } = await gen.generate(['font-mono', 'text-8xl'])
    // Order B: text-8xl first
    const { css: cssB } = await gen.generate(['text-8xl', 'font-mono'])

    // Extract just the .font-mono rule from raw CSS
    const fontMonoRuleRe = /\.font-mono\s*\{([^}]+)\}/
    const ruleA = cssA.match(fontMonoRuleRe)?.[1]
    const ruleB = cssB.match(fontMonoRuleRe)?.[1]
    expect(ruleA, 'font-mono rule should exist in order A').toBeDefined()
    expect(ruleB, 'font-mono rule should exist in order B').toBeDefined()

    // font-mono rule must NOT contain font-size or font shorthand
    const fontShorthandInRule = /(?:^|;)\s*font\s*:[^;]*(?:;|$)/
    expect(ruleA, 'font-mono rule A should not have font shorthand').not.toMatch(fontShorthandInRule)
    expect(ruleB, 'font-mono rule B should not have font shorthand').not.toMatch(fontShorthandInRule)
    expect(ruleA).not.toContain('font-size')
    expect(ruleB).not.toContain('font-size')

    // Check minified output too
    const { simplifyCss } = await import('../../src/build/css/css-utils')
    const minA = await simplifyCss(cssA)
    const minB = await simplifyCss(cssB)

    const minRuleA = minA.match(fontMonoRuleRe)?.[1]
    const minRuleB = minB.match(fontMonoRuleRe)?.[1]
    expect(minRuleA, 'minified font-mono rule A should exist').toBeDefined()
    expect(minRuleB, 'minified font-mono rule B should exist').toBeDefined()
    expect(minRuleA, 'minified font-mono A should not have font shorthand').not.toMatch(fontShorthandInRule)
    expect(minRuleB, 'minified font-mono B should not have font shorthand').not.toMatch(fontShorthandInRule)
  })

  it('font-mono does not reset text-8xl font-size (npmx.dev repro)', async () => {
    clearUnoCache()
    // Exact classes from Package.takumi.vue line 86
    const result = await resolve(['text-8xl', 'font-mono', 'tracking-tighter', 'mb-4'])

    // font-mono should only set font-family
    expect(result['font-mono'], 'font-mono should resolve').toBeDefined()
    expect(result['font-mono']?.['font-family']).toContain('Geist Mono')
    expect(result['font-mono']?.['font-size'], 'font-mono must NOT set font-size').toBeUndefined()
    expect(result['font-mono']?.font, 'font-mono must NOT produce font shorthand').toBeUndefined()

    // text-8xl must resolve with font-size
    expect(result['text-8xl'], 'text-8xl should resolve').toBeDefined()
    expect(result['text-8xl']?.['font-size'], 'text-8xl must have font-size').toBeDefined()

    // tracking-tighter must resolve
    expect(result['tracking-tighter'], 'tracking-tighter should resolve').toBeDefined()
    expect(result['tracking-tighter']?.['letter-spacing'], 'should have letter-spacing').toBeDefined()

    // mb-4 must resolve
    expect(result['mb-4'], 'mb-4 should resolve').toBeDefined()

    // Simulate Object.assign merge (what vue-template-transform does)
    const merged: Record<string, string> = {}
    for (const cls of ['text-8xl', 'font-mono', 'tracking-tighter', 'mb-4']) {
      if (result[cls])
        Object.assign(merged, result[cls])
    }
    expect(merged['font-family'], 'merged should have font-family').toContain('Geist Mono')
    expect(merged['font-size'], 'merged should have font-size').toBeDefined()
    expect(merged['letter-spacing'], 'merged should have letter-spacing').toBeDefined()
    expect(merged['margin-bottom'], 'merged should have margin-bottom').toBeDefined()
  })

  it('font-mono + all text sizes preserve font-size with custom theme', async () => {
    for (const size of ['text-sm', 'text-lg', 'text-xl', 'text-4xl', 'text-8xl']) {
      clearUnoCache()
      const result = await resolve(['font-mono', size])
      expect(result[size], `${size} should resolve alongside font-mono`).toBeDefined()
      expect(result[size]?.['font-size'], `${size} should have font-size`).toBeDefined()
      expect(result['font-mono']?.['font-size'], `font-mono should not steal font-size from ${size}`).toBeUndefined()
    }
  })

  it('font-sans resolves to custom Geist font-family', async () => {
    clearUnoCache()
    const result = await resolve(['font-sans'])
    expect(result['font-sans'], 'font-sans should resolve').toBeDefined()
    expect(result['font-sans']?.['font-family']).toContain('Geist')
    expect(result['font-sans']?.font, 'must NOT produce font shorthand').toBeUndefined()
    expect(result['font-sans']?.['font-size'], 'must NOT set font-size').toBeUndefined()
  })

  it('font-family is unwrapped to first custom family name (quoted multi-word, no generic fallbacks)', async () => {
    clearUnoCache()
    const result = await resolve(['font-mono', 'font-sans'])
    // OG renderers don't do font fallback — generic families are noise.
    // Multi-word names get CSS quotes so they parse as a single family name.
    expect(result['font-mono']?.['font-family']).toBe('\'Geist Mono\'')
    expect(result['font-sans']?.['font-family']).toBe('Geist')
  })
})
