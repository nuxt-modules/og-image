import { describe, expect, it } from 'vitest'
import { sanitizeProps } from '../../src/runtime/shared'

describe('sanitizeProps (GHSA-mg36-wvcr-m75h)', () => {
  it('strips on* event handlers', () => {
    const result = sanitizeProps({ title: 'Hello', onmouseover: 'alert(1)', onclick: 'steal()' })
    expect(result).toEqual({ title: 'Hello' })
  })

  it('strips dangerous HTML attributes', () => {
    const result = sanitizeProps({ title: 'Hi', autofocus: '', contenteditable: 'true', tabindex: '1', accesskey: 'x' })
    expect(result).toEqual({ title: 'Hi' })
  })

  it('preserves legitimate props', () => {
    const result = sanitizeProps({ title: 'Test', description: 'A page', colorMode: 'dark', theme: '#fff' })
    expect(result).toEqual({ title: 'Test', description: 'A page', colorMode: 'dark', theme: '#fff' })
  })

  it('handles empty props', () => {
    expect(sanitizeProps({})).toEqual({})
  })
})
