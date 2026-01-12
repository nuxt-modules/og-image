/**
 * Emoji Unicode to name mapping utilities
 *
 * This file provides utilities for converting Unicode emoji characters to their
 * corresponding Iconify icon names, using a more efficient approach than a large
 * hardcoded mapping.
 */

/**
 * Regular expression to match emoji sequences including multi-codepoint emojis.
 *
 * This regex handles:
 * - Single emoji characters (😀)
 * - Emoji with variation selectors (❤️)
 * - Emoji with skin tone modifiers (👋🏽)
 * - ZWJ sequences like family emojis (👨‍👩‍👧)
 * - Flag sequences (🇺🇸, 🏳️‍🌈)
 * - Keycap sequences (1️⃣, #️⃣)
 *
 * Important: Uses \p{Extended_Pictographic} instead of \p{Emoji} to avoid matching
 * plain digits (0-9), # and * which are technically emoji-capable but shouldn't
 * be treated as emojis when appearing alone.
 *
 * Pattern breakdown:
 * - \p{Extended_Pictographic} matches pictographic emoji characters
 * - [\d#*]\uFE0F\u20E3 matches keycap sequences (digit/hash/asterisk + variation selector + combining enclosing keycap)
 * - \p{Regional_Indicator}{2} matches flag emoji pairs
 * - \p{Emoji_Modifier} handles skin tone modifiers
 * - \uFE0F is variation selector for emoji presentation
 * - \u200D is Zero Width Joiner for combining emojis
 */
export const RE_MATCH_EMOJIS = /(?:\p{Extended_Pictographic}|[\d#*]\uFE0F\u20E3|\p{Regional_Indicator}{2})(?:\p{Emoji_Modifier}|\uFE0F|\u200D[\p{Extended_Pictographic}\p{Emoji}])*/gu

// Common emoji prefixes used by Iconify sets
export const EMOJI_PREFIXES: Record<string, string[]> = {
  // Most emoji sets use kebab-case naming
  'default': ['emoji-', ''],
  // Some sets may have specific prefixes
  'noto': ['', 'emoji-'],
  'twemoji': ['', 'emoji-'],
  'fluent-emoji': ['', 'emoji-'],
  'fluent-emoji-flat': ['', 'emoji-'],
  'fluent-emoji-high-contrast': ['', 'emoji-'],
  'openmoji': ['', 'emoji-'],
  'emojione': ['', 'emoji-'],
}

// Known direct mappings for common emojis
// This is a much smaller subset than the full mapping we had before
export const KNOWN_EMOJI_NAMES: Record<string, string> = {
  '1f44b': 'waving-hand',
  '1f600': 'grinning-face',
  '1f604': 'grinning-face-with-smiling-eyes',
  '1f60d': 'smiling-face-with-heart-eyes',
  '1f618': 'face-blowing-a-kiss',
  '1f44d': 'thumbs-up',
  '1f44e': 'thumbs-down',
  '1f389': 'party-popper',
  '1f680': 'rocket',
  '1f4a5': 'collision',
  '1f525': 'fire',
  '1f381': 'wrapped-gift',
  '1f602': 'face-with-tears-of-joy',
  '1f970': 'smiling-face-with-hearts',
  '1f60a': 'smiling-face-with-smiling-eyes',
  '1f973': 'partying-face',
  '2764': 'red-heart',
  '1f49b': 'yellow-heart',
  '1f499': 'blue-heart',
  '1f49a': 'green-heart',
  '1f49c': 'purple-heart',
  '1f496': 'sparkling-heart',
  '1f495': 'two-hearts',
  '1f4af': 'hundred-points',
  '1f4aa': 'flexed-biceps',
  '1f44f': 'clapping-hands',
  '1f64f': 'folded-hands',
  '1f64c': 'raising-hands',
  '1f9d0': 'face-with-monocle',
  '1f914': 'thinking-face',
  '1f605': 'grinning-face-with-sweat',
  '1f643': 'upside-down-face',
  '1f609': 'winking-face',
  '1f60e': 'smiling-face-with-sunglasses',
  '1f385': 'santa-claus',
  '1f384': 'christmas-tree',
  '1f334': 'palm-tree',
  '1f419': 'octopus',
  '1f98b': 'butterfly',
  '1f41d': 'honeybee',
  '1f436': 'dog-face',
  '1f431': 'cat-face',
  '1f427': 'penguin',
  '1f98a': 'fox',
  '1f438': 'frog',
}

/**
 * Gets possible Iconify icon names for a given Unicode emoji
 *
 * @param codePoint The Unicode code point as a hex string (e.g., "1f44b" or "2764-fe0f")
 * @param emojiSet The emoji set to use (e.g., "noto")
 * @returns An array of possible icon names to try
 */
export function getEmojiIconNames(codePoint: string, emojiSet: string): string[] {
  // Start with prefixes for this emoji set (fallback to default if not found)
  const prefixes = EMOJI_PREFIXES[emojiSet] || EMOJI_PREFIXES.default!

  // Strip variation selector (fe0f) for base lookup
  // e.g., "2764-fe0f" -> "2764" for ❤️
  const baseCodePoint = codePoint.replace(/-fe0f$/i, '')

  // Check for known mapping (try both full and base codepoint)
  const knownName = KNOWN_EMOJI_NAMES[codePoint] || KNOWN_EMOJI_NAMES[baseCodePoint]
  if (knownName) {
    return prefixes.map(prefix => `${prefix}${knownName}`)
  }

  // For unknown emoji, try various naming conventions
  // Include both full codepoint and base (without variation selector)
  const codePoints = codePoint === baseCodePoint ? [codePoint] : [codePoint, baseCodePoint]

  return codePoints.flatMap(cp => [
    // Try direct code point (e.g., "1f44b" or "1f468-200d-1f469-200d-1f467")
    cp,
    // Try with u prefix (e.g., "u1f44b")
    `u${cp}`,
    // Try with emoji- prefix variations
    ...prefixes.map(prefix => `${prefix}u${cp}`),
  ])
}

/**
 * Gets the code point(s) for a Unicode emoji character/sequence
 *
 * @param emoji The emoji character (e.g., "👋" or "👨‍👩‍👧")
 * @returns Hex code point(s) joined by dash (e.g., "1f44b" or "1f468-200d-1f469-200d-1f467")
 */
export function getEmojiCodePoint(emoji: string): string {
  return [...emoji]
    .map(char => char.codePointAt(0)!.toString(16))
    .join('-')
}
