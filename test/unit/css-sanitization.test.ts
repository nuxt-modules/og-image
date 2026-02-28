import { describe, expect, it } from 'vitest'
import { downlevelColor, resolveCssVars, stripAtSupports } from '../../src/build/css/css-utils'
import { sanitizeTakumiStyles } from '../../src/runtime/server/og-image/takumi/sanitize'

describe('stripAtSupports', () => {
  it('strips @supports blocks with nested braces', () => {
    const css = '.test{background-color:rgba(0,188,254,.14)}@supports (color:color-mix(in lab,red,red)){.test{background-color:lab(70.687% -23.6078 -45.9483/.14)}}'
    expect(stripAtSupports(css)).toBe('.test{background-color:rgba(0,188,254,.14)}')
  })

  it('strips multiple @supports blocks', () => {
    const css = '.a{color:red}@supports (color:lab(0 0 0)){.a{color:lab(50% 0 0)}}.b{color:blue}@supports (color:lab(0 0 0)){.b{color:lab(60% 0 0)}}'
    expect(stripAtSupports(css)).toBe('.a{color:red}.b{color:blue}')
  })

  it('preserves CSS without @supports', () => {
    const css = '.a{color:red}.b{color:blue}'
    expect(stripAtSupports(css)).toBe(css)
  })
})

describe('build-time inline style var resolution', () => {
  it('resolves var() in style values using resolveCssVars', () => {
    const vars = new Map([
      ['--border-hover', '#3b82f6'],
      ['--bg', '#0a0a0a'],
    ])
    const style = 'background: linear-gradient(90deg, transparent 5%, var(--border-hover) 35%, var(--border-hover) 65%, transparent 95%)'
    const resolved = resolveCssVars(style, vars)
    expect(resolved).toBe('background: linear-gradient(90deg, transparent 5%, #3b82f6 35%, #3b82f6 65%, transparent 95%)')
    expect(resolved).not.toContain('var(')
  })

  it('resolves nested var() with fallbacks', () => {
    const vars = new Map([['--primary', '#3b82f6']])
    expect(resolveCssVars('color: var(--primary)', vars)).toBe('color: #3b82f6')
    expect(resolveCssVars('color: var(--missing, red)', vars)).toBe('color: red')
  })

  it('downlevelColor converts color-mix with percent to rgba', async () => {
    const result = await downlevelColor('background-color', 'color-mix(in oklab, #00bcfe 14%, transparent)')
    expect(result).toMatch(/^rgba?\(/)
    expect(result).not.toContain('color-mix')
  })

  it('downlevelColor converts oklch to rgba', async () => {
    const result = await downlevelColor('color', 'oklch(0.746 0.16 232.661)')
    expect(result).toMatch(/^#|^rgba?\(/)
    expect(result).not.toContain('oklch')
  })
})

describe('sanitizeTakumiStyles', () => {
  it('strips unresolved var() references', () => {
    const node = { style: { color: 'var(--missing)' } }
    sanitizeTakumiStyles(node)
    expect(node.style.color).toBeUndefined()
  })
})
