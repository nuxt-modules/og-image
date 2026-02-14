import { describe, expect, it } from 'vitest'
import { downlevelColor, resolveCssVars, stripAtSupports } from '../../src/build/css/css-utils'
import { resolveColorMix } from '../../src/runtime/server/og-image/utils/css'
import { linearGradientToSvg, radialGradientToSvg } from '../../src/runtime/server/og-image/utils/gradient-svg'

describe('resolveColorMix', () => {
  it('resolves hex color with decimal fraction', () => {
    expect(resolveColorMix('color-mix(in oklab, #00bcfe .14, transparent)'))
      .toBe('rgba(0, 188, 254, 0.14)')
  })

  it('resolves hex color with percentage', () => {
    expect(resolveColorMix('color-mix(in oklab, #00bcfe 14%, transparent)'))
      .toBe('rgba(0, 188, 254, 0.14)')
  })

  it('resolves short hex color', () => {
    expect(resolveColorMix('color-mix(in oklab, #fff 8%, transparent)'))
      .toBe('rgba(255, 255, 255, 0.08)')
  })

  it('resolves with srgb color space', () => {
    expect(resolveColorMix('color-mix(in srgb, #ffffff 4%, transparent)'))
      .toBe('rgba(255, 255, 255, 0.04)')
  })

  it('passes through non-color-mix values', () => {
    expect(resolveColorMix('rgba(0, 188, 254, 0.14)')).toBe('rgba(0, 188, 254, 0.14)')
    expect(resolveColorMix('red')).toBe('red')
    expect(resolveColorMix('#00bcfe')).toBe('#00bcfe')
  })

  it('returns unresolvable color-mix unchanged (for stripping later)', () => {
    const oklch = 'color-mix(in oklab, oklch(0.7 0.1 200) 14%, transparent)'
    expect(resolveColorMix(oklch)).toBe(oklch)
  })

  it('resolves color-mix embedded in other values', () => {
    // e.g. a border shorthand
    expect(resolveColorMix('1px solid color-mix(in oklab, #00bcfe 50%, transparent)'))
      .toBe('1px solid rgba(0, 188, 254, 0.5)')
  })
})

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

describe('linearGradientToSvg', () => {
  it('converts simple top-to-bottom gradient', () => {
    const svg = linearGradientToSvg('linear-gradient(#fff, #000)')
    expect(svg).toContain('<linearGradient')
    expect(svg).toContain('stop-color="#fff"')
    expect(svg).toContain('stop-color="#000"')
  })

  it('converts angled gradient', () => {
    const svg = linearGradientToSvg('linear-gradient(90deg, transparent 5%, #3b82f6 35%, #3b82f6 65%, transparent 95%)')
    expect(svg).toContain('<linearGradient')
    expect(svg).toContain('stop-color="transparent"')
    expect(svg).toContain('stop-color="#3b82f6"')
  })

  it('returns null for non-gradient', () => {
    expect(linearGradientToSvg('#fff')).toBeNull()
  })
})

describe('radialGradientToSvg', () => {
  it('converts elliptical gradient with position', () => {
    const svg = radialGradientToSvg('radial-gradient(70% 60% at 30% 40%, #252525 0%, #101010 100%)')
    expect(svg).toContain('<radialGradient')
    expect(svg).toContain('cx="0.3"')
    expect(svg).toContain('cy="0.4"')
    expect(svg).toContain('gradientTransform')
    expect(svg).toContain('stop-color="#252525"')
    expect(svg).toContain('stop-color="#101010"')
  })

  it('converts simple radial gradient (defaults)', () => {
    const svg = radialGradientToSvg('radial-gradient(#fff, #000)')
    expect(svg).toContain('<radialGradient')
    expect(svg).toContain('cx="0.5"')
    expect(svg).toContain('cy="0.5"')
    expect(svg).toContain('stop-color="#fff"')
    expect(svg).toContain('stop-color="#000"')
  })

  it('converts circle gradient', () => {
    const svg = radialGradientToSvg('radial-gradient(circle at 50% 50%, #fff, #000)')
    expect(svg).toContain('<radialGradient')
    expect(svg).not.toContain('gradientTransform')
  })

  it('converts gradient with rgba stops', () => {
    const svg = radialGradientToSvg('radial-gradient(rgba(0,0,0,0.5) 0%, rgba(255,255,255,0.8) 100%)')
    expect(svg).toContain('stop-opacity="0.5"')
    expect(svg).toContain('stop-opacity="0.8"')
  })

  it('includes background color rect when provided', () => {
    const svg = radialGradientToSvg('radial-gradient(#fff, #000)', '#ff0000')
    expect(svg).toContain('fill="#ff0000"')
  })

  it('returns null for non-gradient', () => {
    expect(radialGradientToSvg('#fff')).toBeNull()
  })
})
