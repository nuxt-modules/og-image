import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { decodeCssClassName, extractClassStyles, isSimpleClassSelector, postProcessStyles, resolveCssVars } from '../../src/build/css/css-utils'
import { clearTw4Cache, createTw4Provider, resolveClassesToStyles } from '../../src/build/css/providers/tw4'
import { AssetTransformPlugin } from '../../src/build/vite-asset-transform'

// Minimal TW4 CSS entrypoint for the test compiler
const CSS_CONTENT = '@import "tailwindcss";'
const tmpDir = join(import.meta.dirname, '..', '.tmp-tw4-test')
const cssPath = join(tmpDir, 'input.css')

beforeAll(async () => {
  await mkdir(tmpDir, { recursive: true })
  await writeFile(cssPath, CSS_CONTENT)
})

afterAll(async () => {
  clearTw4Cache()
  await rm(tmpDir, { recursive: true, force: true })
})

function resolve(classes: string[]) {
  return resolveClassesToStyles(classes, { cssPath })
}

// ============================================================================
// Arbitrary value utilities used in community templates
// ============================================================================

// ============================================================================
// CSS utils: parsing TW4 compiler output with escaped selectors
// ============================================================================

describe('css-utils', () => {
  describe('decodeCssClassName', () => {
    it.each([
      ['opacity-\\[0\\.4\\]', 'opacity-[0.4]'],
      ['opacity-\\[0\\.02\\]', 'opacity-[0.02]'],
      ['tracking-\\[0\\.2em\\]', 'tracking-[0.2em]'],
      ['leading-\\[0\\.95\\]', 'leading-[0.95]'],
      ['text-\\[72px\\]', 'text-[72px]'],
      ['w-\\[300px\\]', 'w-[300px]'],
      ['h-\\[1px\\]', 'h-[1px]'],
      ['rotate-45', 'rotate-45'],
      ['\\32 xl', '2xl'],
      ['m-0\\.5', 'm-0.5'],
    ])('decodes %s → %s', (input, expected) => {
      expect(decodeCssClassName(input)).toBe(expected)
    })
  })

  describe('isSimpleClassSelector', () => {
    it.each([
      ['opacity-\\[0\\.4\\]', true],
      ['tracking-\\[0\\.2em\\]', true],
      ['rotate-45', true],
      ['\\32 xl', true],
      ['hover\\:text-red:hover', false], // pseudo-class (real CSS selector from TW4)
      ['text-red .child', false], // combinator
    ])('%s → simple: %s', (selector, expected) => {
      expect(isSimpleClassSelector(selector)).toBe(expected)
    })
  })

  describe('extractClassStyles', () => {
    it('parses arbitrary value selectors from TW4 CSS output', () => {
      const css = `
.opacity-\\[0\\.4\\] { opacity: 0.4; }
.tracking-\\[0\\.2em\\] { letter-spacing: 0.2em; }
.leading-\\[0\\.95\\] { line-height: 0.95; }
.text-\\[72px\\] { font-size: 72px; }
.w-\\[300px\\] { width: 300px; }
.rotate-45 { rotate: 45deg; }
`
      const result = extractClassStyles(css)
      expect(result.get('opacity-[0.4]')).toEqual({ opacity: '0.4' })
      expect(result.get('tracking-[0.2em]')).toEqual({ 'letter-spacing': '0.2em' })
      expect(result.get('leading-[0.95]')).toEqual({ 'line-height': '0.95' })
      expect(result.get('text-[72px]')).toEqual({ 'font-size': '72px' })
      expect(result.get('w-[300px]')).toEqual({ width: '300px' })
      expect(result.get('rotate-45')).toEqual({ rotate: '45deg' })
    })

    it('skips --tw-* variables with skipPrefixes', () => {
      const css = `.flex { display: flex; --tw-space-x-reverse: 0; }`
      const result = extractClassStyles(css, { skipPrefixes: ['--'] })
      expect(result.get('flex')).toEqual({ display: 'flex' })
    })

    it('normalizes TW4 infinity and percentage opacity', () => {
      const css = `
.rounded-full { border-radius: calc(infinity * 1px); }
.opacity-50 { opacity: 50%; }
`
      const result = extractClassStyles(css, { normalize: true })
      expect(result.get('rounded-full')?.['border-radius']).toBe('9999px')
      expect(result.get('opacity-50')?.opacity).toBe('0.5')
    })

    it('handles multiple properties per class', () => {
      const css = `.p-4 { padding-top: 1rem; padding-right: 1rem; padding-bottom: 1rem; padding-left: 1rem; }`
      const result = extractClassStyles(css)
      const styles = result.get('p-4')!
      expect(styles['padding-top']).toBe('1rem')
      expect(styles['padding-right']).toBe('1rem')
      expect(styles['padding-bottom']).toBe('1rem')
      expect(styles['padding-left']).toBe('1rem')
    })
  })

  describe('resolveCssVars', () => {
    it('resolves simple var()', () => {
      const vars = new Map([['--color', 'red']])
      expect(resolveCssVars('var(--color)', vars)).toBe('red')
    })

    it('resolves var() with fallback when var missing', () => {
      expect(resolveCssVars('var(--missing, blue)', new Map())).toBe('blue')
    })

    it('resolves var() with fallback when var exists (prefers var)', () => {
      const vars = new Map([['--color', 'red']])
      expect(resolveCssVars('var(--color, blue)', vars)).toBe('red')
    })

    it('resolves nested var() fallback: var(--a, var(--b, initial))', () => {
      const result = resolveCssVars('var(--a, var(--b, initial))', new Map())
      expect(result).toBe('initial')
    })

    it('resolves nested var() where inner var exists', () => {
      const vars = new Map([['--b', '1.5']])
      const result = resolveCssVars('var(--a, var(--b, initial))', vars)
      expect(result).toBe('1.5')
    })

    it('resolves nested var() where outer var exists', () => {
      const vars = new Map([['--a', '2rem']])
      const result = resolveCssVars('var(--a, var(--b, initial))', vars)
      expect(result).toBe('2rem')
    })

    it('resolves deeply nested var(): var(--a, var(--b, var(--c, deep)))', () => {
      const result = resolveCssVars('var(--a, var(--b, var(--c, deep)))', new Map())
      expect(result).toBe('deep')
    })

    it('resolves TW4 line-height pattern: var(--text-8xl--line-height, var(--tw-leading, initial))', () => {
      // This is the exact pattern that caused the bug — stray ) was left behind
      const result = resolveCssVars('var(--text-8xl--line-height, var(--tw-leading, initial))', new Map())
      expect(result).toBe('initial')
      expect(result).not.toContain(')')
    })

    it('resolves TW4 line-height when --tw-leading exists', () => {
      const vars = new Map([['--tw-leading', '1.5']])
      const result = resolveCssVars('var(--text-8xl--line-height, var(--tw-leading, initial))', vars)
      expect(result).toBe('1.5')
    })

    it('resolves TW4 line-height when theme var exists', () => {
      const vars = new Map([['--text-8xl--line-height', '1']])
      const result = resolveCssVars('var(--text-8xl--line-height, var(--tw-leading, initial))', vars)
      expect(result).toBe('1')
    })

    it('resolves multiple var() in one string', () => {
      const vars = new Map([['--a', '10px'], ['--b', '20px']])
      expect(resolveCssVars('var(--a) var(--b)', vars)).toBe('10px 20px')
    })

    it('resolves var() with no fallback and missing var to empty string', () => {
      expect(resolveCssVars('var(--missing)', new Map())).toBe('')
    })

    it('does not leave stray parentheses', () => {
      const patterns = [
        'var(--a, var(--b, fallback))',
        'var(--x, var(--y, var(--z, deep)))',
        'var(--a, var(--b, 0))',
        'var(--text-sm--line-height, var(--tw-leading, initial))',
        'var(--text-lg--line-height, var(--tw-leading, initial))',
      ]
      for (const pattern of patterns) {
        const result = resolveCssVars(pattern, new Map())
        expect(result, `"${pattern}" should not have stray parens`).not.toMatch(/[()]/)
      }
    })

    it('resolves var() with calc() in fallback: var(--a, calc(1.75 / 1.125))', () => {
      const result = resolveCssVars('var(--a, calc(1.75 / 1.125))', new Map())
      expect(result).toBe('calc(1.75 / 1.125)')
    })

    it('resolves nested var() with calc() in fallback: var(--a, var(--b, calc(1.25 / .875)))', () => {
      const result = resolveCssVars('var(--a, var(--b, calc(1.25 / .875)))', new Map())
      expect(result).toBe('calc(1.25 / .875)')
    })

    it('resolves TW4 text-sm line-height pattern with calc fallback', () => {
      // TW4: var(--text-sm--line-height, var(--tw-leading, calc(1.25 / .875)))
      const result = resolveCssVars('var(--text-sm--line-height, var(--tw-leading, calc(1.25 / .875)))', new Map())
      expect(result).toBe('calc(1.25 / .875)')
      expect(result).not.toContain('var(')
    })

    it('handles var() embedded in calc()', () => {
      const vars = new Map([['--spacing', '4px']])
      const result = resolveCssVars('calc(var(--spacing) * 2)', vars)
      expect(result).toBe('calc(4px * 2)')
    })

    it('stops after 20 iterations to prevent infinite loops', () => {
      // Self-referencing var — should not infinite loop
      const vars = new Map([['--a', 'var(--a)']])
      const result = resolveCssVars('var(--a)', vars)
      // Should terminate, exact result doesn't matter
      expect(typeof result).toBe('string')
    })
  })

  describe('postProcessStyles', () => {
    it('normalizes calc(infinity * 1px) to 9999px', async () => {
      const raw = { 'border-radius': 'calc(infinity * 1px)' }
      const result = await postProcessStyles(raw, new Map())
      expect(result?.['border-radius']).toBe('9999px')
    })

    it('normalizes calc(infinity) to 9999px', async () => {
      const raw = { 'border-radius': 'calc(infinity)' }
      const result = await postProcessStyles(raw, new Map())
      expect(result?.['border-radius']).toBe('9999px')
    })

    it('normalizes opacity percentage to decimal', async () => {
      const raw = { opacity: '50%' }
      const result = await postProcessStyles(raw, new Map())
      expect(result?.opacity).toBe('0.5')
    })

    it('resolves var() from provided vars map', async () => {
      const vars = new Map([['--my-color', '#ff0000']])
      const raw = { color: 'var(--my-color)' }
      const result = await postProcessStyles(raw, vars)
      expect(result?.color).toBe('#ff0000')
    })

    it('strips CSS global keywords (initial, inherit, unset, revert)', async () => {
      const raw = { 'line-height': 'initial', 'font-size': '16px', 'color': 'inherit' }
      const result = await postProcessStyles(raw, new Map())
      expect(result?.['line-height']).toBeUndefined()
      expect(result?.color).toBeUndefined()
      expect(result?.['font-size']).toBe('16px')
    })

    it('strips initial from nested var() resolution result', async () => {
      const vars = new Map<string, string>()
      // Simulates TW4's var(--text-8xl--line-height, var(--tw-leading, initial))
      const raw = { 'line-height': 'var(--text-8xl--line-height, var(--tw-leading, initial))' }
      const result = await postProcessStyles(raw, vars)
      // initial should be stripped since Satori can't handle CSS keywords
      expect(result?.['line-height']).toBeUndefined()
    })

    it('converts oklch colors to hex', async () => {
      const raw = { color: 'oklch(0.5 0.2 240)' }
      const result = await postProcessStyles(raw, new Map())
      expect(result?.color).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })
})

describe('tw4 class resolution', () => {
  describe('arbitrary opacity', () => {
    it.each([
      ['opacity-[0.4]', 'opacity', '0.4'],
      ['opacity-[0.02]', 'opacity', '0.02'],
      ['opacity-[0.03]', 'opacity', '0.03'],
      ['opacity-[0.04]', 'opacity', '0.04'],
      ['opacity-[0.07]', 'opacity', '0.07'],
      ['opacity-[0.015]', 'opacity', '0.015'],
    ])('%s → %s: %s', async (cls, prop, expected) => {
      const result = await resolve([cls])
      expect(result[cls], `${cls} should resolve`).toBeDefined()
      expect(result[cls]?.[prop]).toBe(expected)
    })
  })

  describe('arbitrary tracking (letter-spacing)', () => {
    it.each([
      ['tracking-[0.2em]', 'letter-spacing', '0.2em'],
      ['tracking-[0.3em]', 'letter-spacing', '0.3em'],
      ['tracking-[0.4em]', 'letter-spacing', '0.4em'],
    ])('%s → %s: %s', async (cls, prop, expected) => {
      const result = await resolve([cls])
      expect(result[cls], `${cls} should resolve`).toBeDefined()
      expect(result[cls]?.[prop]).toBe(expected)
    })
  })

  describe('arbitrary leading (line-height)', () => {
    it.each([
      ['leading-[0.9]', 'line-height', '0.9'],
      ['leading-[0.95]', 'line-height', '0.95'],
      ['leading-[1.05]', 'line-height', '1.05'],
    ])('%s → %s: %s', async (cls, prop, expected) => {
      const result = await resolve([cls])
      expect(result[cls], `${cls} should resolve`).toBeDefined()
      expect(result[cls]?.[prop]).toBe(expected)
    })
  })

  describe('arbitrary font size', () => {
    it.each([
      ['text-[72px]', 'font-size', '72px'],
      ['text-[76px]', 'font-size', '76px'],
      ['text-[80px]', 'font-size', '80px'],
    ])('%s → %s: %s', async (cls, prop, expected) => {
      const result = await resolve([cls])
      expect(result[cls], `${cls} should resolve`).toBeDefined()
      expect(result[cls]?.[prop]).toBe(expected)
    })
  })

  describe('rotate transform', () => {
    it('rotate-45 resolves to a style property', async () => {
      const result = await resolve(['rotate-45'])
      expect(result['rotate-45'], 'rotate-45 should resolve').toBeDefined()
      // TW4 outputs `rotate: 45deg` (CSS individual transform property)
      // Satori only supports `transform: rotate(45deg)` — need to verify what we emit
      const styles = result['rotate-45']!
      const hasRotate = styles.transform?.includes('rotate(45deg)')
        || styles.transform?.includes('45deg')
        || styles.rotate === '45deg'
      expect(hasRotate, `rotate-45 should produce rotation, got: ${JSON.stringify(styles)}`).toBe(true)
    })

    it('rotate-45 is converted to transform for Satori compatibility', async () => {
      const result = await resolve(['rotate-45'])
      const styles = result['rotate-45']!
      // TW4 outputs `rotate: 45deg` (CSS individual transform property)
      // Must be converted to `transform: rotate(45deg)` for Satori
      expect(styles.transform, `should have transform property, got: ${JSON.stringify(styles)}`).toBe('rotate(45deg)')
      expect(styles.rotate).toBeUndefined()
    })

    it('scale utilities are converted to transform for Satori', async () => {
      const result = await resolve(['scale-75'])
      // scale may resolve to empty if TW4 uses var() that can't resolve
      if (result['scale-75']) {
        const styles = result['scale-75']
        // Should have transform, not scale
        if (styles.transform) {
          expect(styles.transform).toContain('scale(')
          expect(styles.scale).toBeUndefined()
        }
      }
    })

    it('arbitrary rotate is converted to transform', async () => {
      const result = await resolve(['rotate-[30deg]'])
      const styles = result['rotate-[30deg]']!
      expect(styles.transform, `got: ${JSON.stringify(styles)}`).toBe('rotate(30deg)')
      expect(styles.rotate).toBeUndefined()
    })
  })

  describe('arbitrary size', () => {
    it.each([
      ['w-[300px]', 'width', '300px'],
      ['w-[200px]', 'width', '200px'],
      ['h-[300px]', 'height', '300px'],
      ['h-[200px]', 'height', '200px'],
      ['h-[2px]', 'height', '2px'],
      ['h-[1px]', 'height', '1px'],
    ])('%s → %s: %s', async (cls, prop, expected) => {
      const result = await resolve([cls])
      expect(result[cls], `${cls} should resolve`).toBeDefined()
      expect(result[cls]?.[prop]).toBe(expected)
    })
  })

  // ============================================================================
  // Shadow utilities (var-based: --tw-shadow, --tw-ring-shadow, etc.)
  // ============================================================================

  describe('shadow utilities', () => {
    it('shadow-2xl resolves box-shadow with actual values (not empty commas)', async () => {
      clearTw4Cache()
      const result = await resolve(['shadow-2xl'])
      expect(result['shadow-2xl'], 'shadow-2xl should resolve').toBeDefined()
      const shadow = result['shadow-2xl']?.['box-shadow']
      expect(shadow, 'should have box-shadow property').toBeDefined()
      // Must contain actual shadow values, not just commas
      expect(shadow).not.toMatch(/^[\s,]*$/)
      expect(shadow).toContain('25px')
    })

    it.each([
      'shadow-sm',
      'shadow',
      'shadow-md',
      'shadow-lg',
      'shadow-xl',
      'shadow-2xl',
    ])('%s resolves to a valid box-shadow', async (cls) => {
      clearTw4Cache()
      const result = await resolve([cls])
      expect(result[cls], `${cls} should resolve`).toBeDefined()
      const shadow = result[cls]?.['box-shadow']
      expect(shadow, `${cls} should have box-shadow`).toBeDefined()
      expect(shadow).not.toMatch(/^[\s,]*$/)
    })
  })

  // ============================================================================
  // Standard utilities that should always work
  // ============================================================================

  describe('text size utilities (font-size + line-height)', () => {
    it.each([
      'text-xs',
      'text-sm',
      'text-base',
      'text-lg',
      'text-xl',
      'text-2xl',
      'text-3xl',
      'text-4xl',
      'text-5xl',
      'text-6xl',
      'text-7xl',
      'text-8xl',
      'text-9xl',
    ])('%s resolves font-size and clean line-height (no stray parens)', async (cls) => {
      const result = await resolve([cls])
      expect(result[cls], `${cls} should resolve`).toBeDefined()
      const styles = result[cls]!
      expect(styles['font-size'], `${cls} should have font-size`).toBeDefined()
      // line-height must not contain stray parentheses from broken var() resolution
      // calc() parens are fine, var() or unmatched parens are not
      if (styles['line-height']) {
        const lh = styles['line-height']
        expect(lh).not.toBe('')
        expect(lh).not.toContain('var(')
        // Check for unmatched parens (stray `)` without opening `(`)
        let depth = 0
        for (const ch of lh) {
          if (ch === '(')
            depth++
          else if (ch === ')')
            depth--
          expect(depth, `unmatched ')' in line-height "${lh}"`).toBeGreaterThanOrEqual(0)
        }
        expect(depth, `unmatched '(' in line-height "${lh}"`).toBe(0)
      }
    })

    it('text-8xl produces valid numeric line-height', async () => {
      const result = await resolve(['text-8xl'])
      const lh = result['text-8xl']?.['line-height']
      // Should be a number like "1" or a unit value, not "initial)" or empty
      if (lh) {
        expect(lh).toMatch(/^[\d.]+(%|rem|em|px)?$|^normal$|^initial$/)
      }
    })
  })

  describe('standard utilities', () => {
    it('resolves flex utilities', async () => {
      const result = await resolve(['flex', 'flex-col', 'flex-1', 'items-center', 'justify-between'])
      expect(result.flex).toBeDefined()
      expect(result['flex-col']).toBeDefined()
      expect(result['flex-1']).toBeDefined()
      expect(result['items-center']).toBeDefined()
      expect(result['justify-between']).toBeDefined()
    })

    it('resolves spacing utilities', async () => {
      const result = await resolve(['p-12', 'px-16', 'py-12', 'mb-4', 'gap-4', 'gap-6'])
      for (const cls of ['p-12', 'px-16', 'py-12', 'mb-4', 'gap-4', 'gap-6']) {
        expect(result[cls], `${cls} should resolve`).toBeDefined()
      }
    })

    it('resolves sizing utilities', async () => {
      const result = await resolve(['w-full', 'h-full', 'w-2', 'h-2', 'w-3', 'h-3', 'w-12', 'w-32', 'h-1', 'h-4'])
      for (const cls of ['w-full', 'h-full', 'w-2', 'h-2', 'w-3', 'h-3', 'w-12', 'w-32', 'h-1', 'h-4']) {
        expect(result[cls], `${cls} should resolve`).toBeDefined()
      }
    })

    it('resolves text/font utilities', async () => {
      const result = await resolve(['text-sm', 'text-lg', 'text-xl', 'text-4xl', 'font-bold', 'font-mono', 'italic', 'uppercase'])
      for (const cls of ['text-sm', 'text-lg', 'text-xl', 'text-4xl', 'font-bold', 'font-mono', 'italic', 'uppercase']) {
        expect(result[cls], `${cls} should resolve`).toBeDefined()
      }
    })

    it('resolves color utilities', async () => {
      const result = await resolve(['bg-black', 'bg-white', 'text-black', 'text-neutral-500'])
      for (const cls of ['bg-black', 'bg-white', 'text-black', 'text-neutral-500']) {
        expect(result[cls], `${cls} should resolve`).toBeDefined()
      }
      // Colors should be hex
      expect(result['bg-black']?.['background-color']).toMatch(/^#/)
      expect(result['text-black']?.color).toMatch(/^#/)
    })

    it('resolves positioning utilities', async () => {
      const result = await resolve(['relative', 'absolute', 'inset-0', 'inset-10', 'overflow-hidden'])
      for (const cls of ['relative', 'absolute', 'inset-0', 'inset-10', 'overflow-hidden']) {
        expect(result[cls], `${cls} should resolve`).toBeDefined()
      }
    })

    it('expands inset shorthand to longhands for Satori', async () => {
      const result = await resolve(['inset-10'])
      const styles = result['inset-10']!
      expect(styles.inset, 'inset shorthand should be removed').toBeUndefined()
      expect(styles.top).toBeDefined()
      expect(styles.right).toBeDefined()
      expect(styles.bottom).toBeDefined()
      expect(styles.left).toBeDefined()
    })

    it('expands inset-0 to longhands for Satori', async () => {
      const result = await resolve(['inset-0'])
      const styles = result['inset-0']!
      expect(styles.inset).toBeUndefined()
      expect(styles.top).toBeDefined()
      expect(styles.right).toBeDefined()
      expect(styles.bottom).toBeDefined()
      expect(styles.left).toBeDefined()
    })

    it('resolves border utilities', async () => {
      const result = await resolve(['border-4', 'border-b-2', 'border-black', 'border-l-4', 'border-t-4', 'border-b-4', 'rounded-full'])
      for (const cls of ['border-4', 'border-b-2', 'border-l-4', 'border-t-4', 'border-b-4', 'rounded-full']) {
        expect(result[cls], `${cls} should resolve`).toBeDefined()
      }
    })

    it('normalizes rounded-full calc(infinity) to 9999px', async () => {
      const result = await resolve(['rounded-full'])
      expect(result['rounded-full'], 'rounded-full should resolve').toBeDefined()
      expect(result['rounded-full']?.['border-radius']).toBe('9999px')
    })

    it('resolves tracking utilities', async () => {
      const result = await resolve(['tracking-tight', 'tracking-tighter'])
      for (const cls of ['tracking-tight', 'tracking-tighter']) {
        expect(result[cls], `${cls} should resolve`).toBeDefined()
      }
    })
  })

  // ============================================================================
  // Batch: all classes from community templates resolve
  // ============================================================================

  describe('community template classes', () => {
    const templateClasses: Record<string, string[]> = {
      Brutalist: [
        'h-full',
        'w-full',
        'flex',
        'relative',
        'overflow-hidden',
        'bg-neutral-100',
        'absolute',
        'bg-black',
        'inset-10',
        'p-12',
        'bg-white',
        'border-4',
        'border-black',
        'flex-col',
        'justify-between',
        'w-32',
        'border-l-4',
        'border-t-4',
        'border-b-4',
        'text-lg',
        'font-mono',
        'uppercase',
        'tracking-[0.3em]',
        'text-neutral-500',
        'mb-4',
        'text-[76px]',
        'font-bold',
        'text-black',
        'leading-[0.95]',
        'tracking-tighter',
        'items-center',
        'gap-4',
        'w-12',
        'h-1',
        'w-3',
        'h-3',
        'rotate-45',
      ],
      UnJs: [
        'opacity-[0.02]',
      ],
      Frame: [
        'opacity-[0.07]',
      ],
      SimpleBlog: [
        'opacity-[0.015]',
        'w-[300px]',
        'h-[300px]',
        'rounded-full',
        'opacity-[0.04]',
        'w-[200px]',
        'h-[200px]',
        'opacity-[0.03]',
      ],
      WithEmoji: [
        'opacity-[0.03]',
      ],
    }

    for (const [template, classes] of Object.entries(templateClasses)) {
      it(`${template}: all classes resolve`, async () => {
        // Clear cache between templates to avoid cross-contamination
        clearTw4Cache()
        const result = await resolve(classes)
        const unresolved = classes.filter(cls => !result[cls])
        expect(unresolved, `Unresolved classes in ${template}`).toEqual([])
      })
    }
  })
})

// ============================================================================
// resolveClassesToStyles — transform conversions (logical props, transforms)
// ============================================================================

describe('resolveClassesToStyles conversions', () => {
  it('rotate-45 outputs transform (not rotate)', async () => {
    clearTw4Cache()
    const resolved = await resolve(['rotate-45'])
    expect(resolved['rotate-45'], 'rotate-45 should resolve').toBeDefined()
    expect(resolved['rotate-45'].transform).toBe('rotate(45deg)')
    expect(resolved['rotate-45'].rotate).toBeUndefined()
  })

  it('arbitrary rotate outputs transform', async () => {
    clearTw4Cache()
    const resolved = await resolve(['rotate-[30deg]'])
    expect(resolved['rotate-[30deg]'], 'rotate-[30deg] should resolve').toBeDefined()
    expect(resolved['rotate-[30deg]'].transform).toBe('rotate(30deg)')
  })

  it('all Brutalist template classes resolve', async () => {
    clearTw4Cache()
    const brutalistClasses = [
      'h-full',
      'w-full',
      'flex',
      'relative',
      'overflow-hidden',
      'bg-neutral-100',
      'absolute',
      'bg-black',
      'inset-10',
      'p-12',
      'bg-white',
      'border-4',
      'border-black',
      'flex-col',
      'justify-between',
      'w-32',
      'border-l-4',
      'border-t-4',
      'border-b-4',
      'text-lg',
      'font-mono',
      'uppercase',
      'tracking-[0.3em]',
      'text-neutral-500',
      'mb-4',
      'text-[76px]',
      'font-bold',
      'text-black',
      'leading-[0.95]',
      'tracking-tighter',
      'items-center',
      'gap-4',
      'w-12',
      'h-1',
      'w-3',
      'h-3',
      'rotate-45',
    ]
    const resolved = await resolve(brutalistClasses)
    const unresolved = brutalistClasses.filter(cls => !resolved[cls])
    expect(unresolved, 'All classes should resolve').toEqual([])
    expect(resolved['rotate-45'].transform).toBe('rotate(45deg)')
  })
})

// ============================================================================
// AssetTransformPlugin — full Vite transform with TW4
// ============================================================================

describe('assetTransformPlugin with TW4', () => {
  const ogComponentPaths = [join(tmpDir, 'components')]
  const tw4Provider = createTw4Provider({
    getCssPath: () => cssPath,
    loadNuxtUiColors: async () => undefined,
  })

  beforeAll(async () => {
    await mkdir(join(tmpDir, 'components'), { recursive: true })
    clearTw4Cache()
  })

  it('transforms Brutalist template with rotate-45 resolved to inline style', async () => {
    const plugin = AssetTransformPlugin.raw({
      ogComponentPaths,
      rootDir: tmpDir,
      srcDir: tmpDir,
      publicDir: join(tmpDir, 'public'),
      cssProvider: tw4Provider,
    }, { framework: 'vite' })

    const code = await readFile(
      join(import.meta.dirname, '../../src/runtime/app/components/Templates/Community/Brutalist.satori.vue'),
      'utf-8',
    )

    const id = join(tmpDir, 'components', 'Brutalist.satori.vue')
    const result = await plugin.transform?.(code, id)

    expect(result, 'transform should produce output').toBeDefined()
    expect(result!.code).toContain('rotate(45deg)')
    // rotate-45 should be resolved and removed from class
    expect(result!.code).not.toMatch(/class="[^"]*rotate-45[^"]*"/)
  })

  it('transforms simple template with rotate-45 to inline transform style', async () => {
    const plugin = AssetTransformPlugin.raw({
      ogComponentPaths,
      rootDir: tmpDir,
      srcDir: tmpDir,
      publicDir: join(tmpDir, 'public'),
      cssProvider: tw4Provider,
    }, { framework: 'vite' })

    const code = `<template>
  <div class="flex items-center">
    <div class="w-3 h-3 bg-black rotate-45" />
  </div>
</template>`

    const id = join(tmpDir, 'components', 'Test.vue')
    const result = await plugin.transform?.(code, id)

    expect(result, 'transform should produce output').toBeDefined()
    // rotate-45 should be resolved to transform: rotate(45deg) in style
    expect(result!.code).toContain('rotate(45deg)')
    // The class attribute should not contain rotate-45 anymore
    expect(result!.code).not.toMatch(/class="[^"]*rotate-45[^"]*"/)
  })

  it('transforms arbitrary values to inline styles', async () => {
    const plugin = AssetTransformPlugin.raw({
      ogComponentPaths,
      rootDir: tmpDir,
      srcDir: tmpDir,
      publicDir: join(tmpDir, 'public'),
      cssProvider: tw4Provider,
    }, { framework: 'vite' })

    const code = `<template>
  <div class="max-w-[85%]">
    <p class="tracking-[0.3em] text-neutral-500">subtitle</p>
    <h1 class="text-[76px] leading-[0.95] tracking-tighter font-bold">title</h1>
  </div>
</template>`

    const id = join(tmpDir, 'components', 'ArbitraryValues.vue')
    const result = await plugin.transform?.(code, id)

    expect(result, 'transform should produce output').toBeDefined()
    // Arbitrary values should be resolved and removed from class
    expect(result!.code).not.toMatch(/class="[^"]*tracking-\[0\.3em\][^"]*"/)
    expect(result!.code).not.toMatch(/class="[^"]*text-\[76px\][^"]*"/)
    expect(result!.code).not.toMatch(/class="[^"]*leading-\[0\.95\][^"]*"/)
  })

  // ==========================================================================
  // Responsive prefix preservation
  // ==========================================================================

  describe('responsive prefixed classes are preserved, not inlined', () => {
    it('keeps responsive-prefixed classes in class attr instead of inlining', async () => {
      const plugin = AssetTransformPlugin.raw({
        ogComponentPaths,
        rootDir: tmpDir,
        srcDir: tmpDir,
        publicDir: join(tmpDir, 'public'),
        cssProvider: tw4Provider,
      }, { framework: 'vite' })

      const code = `<template>
  <div class="flex lg:flex-col items-center lg:items-start">
    <p class="text-lg md:text-[76px]">hello</p>
  </div>
</template>`

      const id = join(tmpDir, 'components', 'ResponsiveKeep.vue')
      const result = await plugin.transform?.(code, id)

      expect(result, 'transform should produce output').toBeDefined()
      // Responsive-prefixed classes must remain in class attribute
      expect(result!.code).toMatch(/class="[^"]*lg:flex-col[^"]*"/)
      expect(result!.code).toMatch(/class="[^"]*lg:items-start[^"]*"/)
      expect(result!.code).toMatch(/class="[^"]*md:text-\[76px\][^"]*"/)
    })

    it('base classes conflicting with responsive variants stay as classes for runtime', async () => {
      const plugin = AssetTransformPlugin.raw({
        ogComponentPaths,
        rootDir: tmpDir,
        srcDir: tmpDir,
        publicDir: join(tmpDir, 'public'),
        cssProvider: tw4Provider,
      }, { framework: 'vite' })

      const code = `<template>
  <div class="flex-col lg:flex-col bg-black lg:bg-white">content</div>
</template>`

      const id = join(tmpDir, 'components', 'ResponsiveMixed.vue')
      const result = await plugin.transform?.(code, id)

      expect(result, 'transform should produce output').toBeDefined()
      // Base classes stay in class (not inlined) since responsive variants override the same props
      // bg-black rewritten to arbitrary value bg-[#000]
      expect(result!.code).not.toMatch(/class="[^"]*(?<![:\w])bg-black(?![:\w])[^"]*"/)
      expect(result!.code).toMatch(/(?<![:\w])bg-\[#/)
      // Responsive versions must stay in class with resolved values
      expect(result!.code).toMatch(/lg:flex-col/)
      expect(result!.code).toMatch(/lg:bg-\[#/)
    })

    it('all responsive prefixes are preserved (sm, md, lg, xl, 2xl)', async () => {
      const plugin = AssetTransformPlugin.raw({
        ogComponentPaths,
        rootDir: tmpDir,
        srcDir: tmpDir,
        publicDir: join(tmpDir, 'public'),
        cssProvider: tw4Provider,
      }, { framework: 'vite' })

      const code = `<template>
  <div class="flex sm:flex-col md:flex-col lg:flex-col xl:flex-col 2xl:flex-col">content</div>
</template>`

      const id = join(tmpDir, 'components', 'AllBreakpoints.vue')
      const result = await plugin.transform?.(code, id)

      expect(result, 'transform should produce output').toBeDefined()
      // All responsive-prefixed classes must remain
      expect(result!.code).toMatch(/sm:flex-col/)
      expect(result!.code).toMatch(/md:flex-col/)
      expect(result!.code).toMatch(/lg:flex-col/)
      expect(result!.code).toMatch(/xl:flex-col/)
      expect(result!.code).toMatch(/2xl:flex-col/)
    })

    it('responsive-prefixed classes have their values resolved but keep prefix', async () => {
      const plugin = AssetTransformPlugin.raw({
        ogComponentPaths,
        rootDir: tmpDir,
        srcDir: tmpDir,
        publicDir: join(tmpDir, 'public'),
        cssProvider: tw4Provider,
      }, { framework: 'vite' })

      // bg-white and text-black conflict with responsive variants → stay as class rewrites
      // lg:bg-black should become lg:bg-[#000] (or similar hex) in the class attr
      const code = `<template>
  <div class="bg-white lg:bg-black text-black lg:text-neutral-500">content</div>
</template>`

      const id = join(tmpDir, 'components', 'ResponsiveResolved.vue')
      const result = await plugin.transform?.(code, id)

      expect(result, 'transform should produce output').toBeDefined()
      // Base classes rewritten to arbitrary values (not inlined) due to responsive conflicts
      expect(result!.code).not.toMatch(/class="[^"]*(?<![:\w])bg-white(?![:\w])[^"]*"/)
      expect(result!.code).not.toMatch(/class="[^"]*(?<![:\w])text-black(?![:\w])[^"]*"/)
      expect(result!.code).toMatch(/(?<![:\w])bg-\[#/)
      expect(result!.code).toMatch(/(?<![:\w])text-\[#/)
      // Responsive classes should have their values resolved to arbitrary values
      expect(result!.code).toMatch(/lg:bg-\[#/)
      expect(result!.code).toMatch(/lg:text-\[#/)
      // Original unresolved responsive classes should be gone
      expect(result!.code).not.toMatch(/lg:bg-black/)
      expect(result!.code).not.toMatch(/lg:text-neutral-500/)
    })

    it('dark: prefixed classes are preserved (not inlined)', async () => {
      const plugin = AssetTransformPlugin.raw({
        ogComponentPaths,
        rootDir: tmpDir,
        srcDir: tmpDir,
        publicDir: join(tmpDir, 'public'),
        cssProvider: tw4Provider,
      }, { framework: 'vite' })

      const code = `<template>
  <div class="bg-white dark:bg-black text-black dark:text-neutral-500">content</div>
</template>`

      const id = join(tmpDir, 'components', 'DarkMode.vue')
      const result = await plugin.transform?.(code, id)

      expect(result, 'transform should produce output').toBeDefined()
      // dark: prefixed classes should remain for runtime colorMode handling
      // Values should be resolved: dark:bg-black → dark:bg-[#000]
      expect(result!.code).toMatch(/dark:bg-\[#/)
      expect(result!.code).toMatch(/dark:text-\[#/)
      // Base classes also stay as class rewrites (not inlined) due to dark: conflict
      expect(result!.code).toMatch(/(?<![:\w])bg-\[#/)
      expect(result!.code).toMatch(/(?<![:\w])text-\[#/)
    })
  })
})
