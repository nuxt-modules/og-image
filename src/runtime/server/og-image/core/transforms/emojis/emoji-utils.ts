/**
 * Emoji Unicode to name mapping utilities
 *
 * This file provides utilities for converting Unicode emoji characters to their
 * corresponding Iconify icon names.
 */

// Minimal subset (~100 common emojis), use Nuxt Icon for more
import { EMOJI_CODEPOINT_TO_NAME } from './emoji-names-minimal'

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

/**
 * Gets possible Iconify icon names for a given Unicode emoji
 *
 * @param codePoint The Unicode code point as a hex string (e.g., "1f44b" or "2764-fe0f")
 * @param _emojiSet The emoji set to use (currently only noto is fully supported)
 * @returns An array of possible icon names to try
 */
export function getEmojiIconNames(codePoint: string, _emojiSet: string): string[] {
  // Strip variation selector (fe0f) for base lookup
  // e.g., "2764-fe0f" -> "2764" for ❤️
  const baseCodePoint = codePoint.replace(/-fe0f$/i, '')

  // Check comprehensive mapping (try both full and base codepoint)
  const knownName = EMOJI_CODEPOINT_TO_NAME[codePoint] || EMOJI_CODEPOINT_TO_NAME[baseCodePoint]
  if (knownName) {
    return [knownName]
  }

  // For unknown emoji, try code point as fallback (some sets use this)
  return [codePoint, baseCodePoint, `u${baseCodePoint}`].filter((v, i, a) => a.indexOf(v) === i)
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
