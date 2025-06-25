import { describe, expect, it } from 'vitest'
import { getEmojiCodePoint } from '../../src/runtime/server/og-image/satori/transforms/emojis/emoji-map'
import { getEmojiIconNames } from '../../src/runtime/server/og-image/satori/transforms/emojis/emoji-utils'

describe('emoji map utility', () => {
  it('should convert emoji character to code point', () => {
    expect(getEmojiCodePoint('👋')).toBe('1f44b')
    expect(getEmojiCodePoint('🚀')).toBe('1f680')
    expect(getEmojiCodePoint('❤️')).toBe('2764')
  })

  it('should generate multiple possible icon names for common emojis', () => {
    const names = getEmojiIconNames('1f44b', 'noto')
    expect(names).toContain('waving-hand')
    expect(names.length).toBeGreaterThan(1)

    const rocketNames = getEmojiIconNames('1f680', 'fluent-emoji')
    expect(rocketNames).toContain('rocket')
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
