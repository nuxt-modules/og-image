import { describe, expect, it } from 'vitest'
import { getEmojiCodePoint, getEmojiIconNames } from '../../src/runtime/server/og-image/satori/transforms/emojis/emoji-utils'

describe('emoji map utility', () => {
  it('should convert emoji character to code point', () => {
    expect(getEmojiCodePoint('👋')).toBe('1f44b')
    expect(getEmojiCodePoint('🚀')).toBe('1f680')
    // ❤️ includes variation selector (fe0f), so returns joined code points
    expect(getEmojiCodePoint('❤️')).toBe('2764-fe0f')
    // Plain heart without variation selector
    expect(getEmojiCodePoint('❤')).toBe('2764')
  })

  it('should handle multi-codepoint emoji sequences', () => {
    // Family emoji (ZWJ sequence)
    expect(getEmojiCodePoint('👨‍👩‍👧')).toBe('1f468-200d-1f469-200d-1f467')
    // Skin tone modifier
    expect(getEmojiCodePoint('👋🏽')).toBe('1f44b-1f3fd')
  })

  it('should generate multiple possible icon names for common emojis', () => {
    const names = getEmojiIconNames('1f44b', 'noto')
    expect(names).toContain('waving-hand')
    expect(names.length).toBeGreaterThan(1)

    const rocketNames = getEmojiIconNames('1f680', 'fluent-emoji')
    expect(rocketNames).toContain('rocket')
  })

  it('should handle variation selectors by stripping them for lookup', () => {
    // ❤️ with variation selector should still find 'red-heart'
    const names = getEmojiIconNames('2764-fe0f', 'noto')
    expect(names).toContain('red-heart')
  })

  it('should handle unknown emojis with reasonable fallbacks', () => {
    // A made up code point that's not in our KNOWN_EMOJI_NAMES
    const names = getEmojiIconNames('abcdef', 'twemoji')
    expect(names.length).toBeGreaterThan(0)
    // Should include the raw code point as fallback
    expect(names).toContain('abcdef')
  })
})

// Skip implementation tests since they can't properly be tested without the real imports
describe.skip('emoji resolving', () => {
  it('should work with real implementations', () => {
    expect(true).toBe(true)
  })
})

// Skip module tests in unit tests since they require the full build process
describe.skip('module selection logic', () => {
  it('uses local implementation when iconify deps are available', () => {
    // This would be tested in integration tests
    expect(true).toBe(true)
  })
})
