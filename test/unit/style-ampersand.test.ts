import { describe, expect, it } from 'vitest'
import { parseStyleAttr } from '../../src/runtime/server/og-image/core/style-attr'
import { splitCssDeclarations } from '../../src/runtime/server/og-image/utils/css'

describe('parseStyleAttr &amp; decoding', () => {
  it('decodes &amp; in URL values', () => {
    expect(parseStyleAttr('background-image: url(https://example.com/img.png?w=1200&amp;q=80)'))
      .toEqual({ backgroundImage: 'url(https://example.com/img.png?w=1200&q=80)' })
  })

  it('does not break styles without &amp;', () => {
    expect(parseStyleAttr('color: red; font-size: 16px'))
      .toEqual({ color: 'red', fontSize: '16px' })
  })

  it('handles multiple &amp; in a single URL', () => {
    expect(parseStyleAttr('background-image: url(https://example.com/img?a=1&amp;b=2&amp;c=3)'))
      .toEqual({ backgroundImage: 'url(https://example.com/img?a=1&b=2&c=3)' })
  })

  it('handles &amp; in URL alongside other style properties', () => {
    const result = parseStyleAttr('display: flex; background-image: url(https://example.com?w=1200&amp;q=80); color: red')
    expect(result?.display).toBe('flex')
    expect(result?.backgroundImage).toBe('url(https://example.com?w=1200&q=80)')
    expect(result?.color).toBe('red')
  })

  it('decodes &quot; inside url() so the renderer sees real quotes', () => {
    const style = 'background-image: url(&quot;data:image/svg+xml,%3Csvg/%3E&quot;)'
    expect(parseStyleAttr(style)?.backgroundImage)
      .toBe('url("data:image/svg+xml,%3Csvg/%3E")')
  })

  it('decodes &#39; (single-quote entity) inside CSS values', () => {
    const style = 'font-family: &#39;Inter&#39;'
    expect(parseStyleAttr(style)?.fontFamily).toBe('Inter')
  })

  it('does not split declarations on a ; inside a &quot;-quoted url()', () => {
    const style = `background-image: url(&quot;data:image/svg+xml;utf8,%3Csvg/%3E&quot;); color: red`
    const result = parseStyleAttr(style)
    expect(result?.backgroundImage).toBe('url("data:image/svg+xml;utf8,%3Csvg/%3E")')
    expect(result?.color).toBe('red')
  })

  it('does not double-unescape `&amp;quot;` into a real `"`', () => {
    // Single-pass entity decode: `&amp;` and `&quot;` are matched in one regex
    // so the literal `&` from `&amp;` cannot combine with following `quot;` to
    // form a spurious `&quot;` match. This is the CodeQL `js/double-escaping`
    // shape, even though realistic Vue SSR output never produces `&amp;quot;`.
    const decoded = parseStyleAttr('color: red &amp;quot;')
    // The decoded payload starts with the literal `&` we wanted, not `"`.
    expect(decoded?.color).toMatch(/^red &/)
    expect(decoded?.color).not.toMatch(/^red "/)
  })
})

describe('splitCssDeclarations', () => {
  it('splits simple declarations', () => {
    expect(splitCssDeclarations('color: red; font-size: 16px'))
      .toEqual(['color: red', ' font-size: 16px'])
  })

  it('preserves semicolons inside url()', () => {
    const style = `mask-image: url("data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E"); display: inline-block`
    const parts = splitCssDeclarations(style)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toContain('data:image/svg+xml;utf8,')
    expect(parts[1]).toContain('display')
  })

  it('preserves semicolons inside single-quoted url()', () => {
    const style = `mask-image: url('data:image/svg+xml;base64,PHN2Zz4='); width: 32px`
    const parts = splitCssDeclarations(style)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toContain('base64,')
  })

  it('preserves semicolons inside unquoted url()', () => {
    const style = `mask-image: url(data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E); height: 24px`
    const parts = splitCssDeclarations(style)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toContain('svg+xml;utf8,')
  })

  it('handles empty input', () => {
    expect(splitCssDeclarations('')).toEqual([])
  })

  it('handles trailing semicolons', () => {
    expect(splitCssDeclarations('color: red;')).toEqual(['color: red'])
  })
})

describe('parseStyleAttr url() semicolons', () => {
  it('preserves data URI with semicolons', () => {
    const style = `mask-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E"); display: inline-block`
    const result = parseStyleAttr(style)
    expect(result?.maskImage).toContain('data:image/svg+xml;utf8,')
    expect(result?.display).toBe('inline-block')
  })

  it('does not produce garbled http property from xmlns URL', () => {
    const style = `mask-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' %3E%3Cpath fill='none'/%3E%3C/svg%3E")`
    const result = parseStyleAttr(style)
    expect(result).not.toHaveProperty('http')
    expect(result?.maskImage).toContain('http://www.w3.org/2000/svg')
  })

  it('preserves base64 data URI', () => {
    const style = `background-image: url("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="); width: 32px`
    const result = parseStyleAttr(style)
    expect(result?.backgroundImage).toContain('data:image/svg+xml;base64,')
    expect(result?.width).toBe('32px')
  })
})

describe('iCON_CLASS_RE', () => {
  // Mirrors the regex from vite-asset-transform.ts
  const ICON_CLASS_RE = /^i-([a-z\d]+(?:-[a-z\d]+)*)[-:](.+)$/

  it('matches hyphen-separated icon classes', () => {
    const m = 'i-lucide-star'.match(ICON_CLASS_RE)
    expect(m?.[1]).toBe('lucide')
    expect(m?.[2]).toBe('star')
  })

  it('matches colon-separated icon classes', () => {
    const m = 'i-lucide:star'.match(ICON_CLASS_RE)
    expect(m?.[1]).toBe('lucide')
    expect(m?.[2]).toBe('star')
  })

  it('matches multi-word collection with colon', () => {
    const m = 'i-simple-icons:github'.match(ICON_CLASS_RE)
    expect(m?.[1]).toBe('simple-icons')
    expect(m?.[2]).toBe('github')
  })

  it('matches multi-word collection with hyphen separator', () => {
    const m = 'i-simple-icons-github'.match(ICON_CLASS_RE)
    expect(m?.[1]).toBe('simple-icons')
    expect(m?.[2]).toBe('github')
  })

  it('matches icon names with hyphens', () => {
    const m = 'i-lucide:arrow-right'.match(ICON_CLASS_RE)
    expect(m?.[1]).toBe('lucide')
    expect(m?.[2]).toBe('arrow-right')
  })

  it('matches short collection names', () => {
    const m = 'i-ep:plus'.match(ICON_CLASS_RE)
    expect(m?.[1]).toBe('ep')
    expect(m?.[2]).toBe('plus')
  })
})
