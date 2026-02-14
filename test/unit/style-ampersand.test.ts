import { describe, expect, it } from 'vitest'

/**
 * Mirrors parseStyleAttr from src/runtime/server/og-image/core/vnodes.ts
 * to verify the &amp; decoding fix without hitting virtual module imports.
 */
function camelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

function parseStyleAttr(style: string | null | undefined): Record<string, any> | undefined {
  if (!style)
    return undefined
  const result: Record<string, any> = {}
  // Decode &amp; before splitting — the `;` in `&amp;` would otherwise act as
  // a CSS declaration separator and truncate values containing `&` (e.g. URLs).
  for (const decl of style.replace(/&amp;/g, '&').split(';')) {
    const colonIdx = decl.indexOf(':')
    if (colonIdx === -1)
      continue
    const prop = decl.slice(0, colonIdx).trim()
    const val = decl.slice(colonIdx + 1).trim()
    if (prop && val)
      result[camelCase(prop)] = val
  }
  return Object.keys(result).length ? result : undefined
}

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

  it('without fix: &amp; semicolon would truncate the value', () => {
    // Demonstrates what the old code would produce (incorrect)
    const broken: Record<string, any> = {}
    for (const decl of 'background-image: url(https://example.com?w=1200&amp;q=80)'.split(';')) {
      const colonIdx = decl.indexOf(':')
      if (colonIdx === -1)
        continue
      const prop = decl.slice(0, colonIdx).trim()
      const val = decl.slice(colonIdx + 1).trim()
      if (prop && val)
        broken[camelCase(prop)] = val
    }
    // Old behavior: URL truncated at &amp — the `;` split cuts it off
    expect(broken.backgroundImage).toBe('url(https://example.com?w=1200&amp')
  })
})
