/**
 * Emoji Unicode to name mapping utilities
 * 
 * This file provides utilities for converting Unicode emoji characters to their
 * corresponding Iconify icon names, using a more efficient approach than a large
 * hardcoded mapping.
 */

// Common emoji prefixes used by Iconify sets
const EMOJI_PREFIXES: Record<string, string[]> = {
  // Most emoji sets use kebab-case naming
  default: ['emoji-', ''],
  // Some sets may have specific prefixes
  noto: ['', 'emoji-'],
  twemoji: ['', 'emoji-'],
  'fluent-emoji': ['', 'emoji-'],
  'fluent-emoji-flat': ['', 'emoji-'],
  'fluent-emoji-high-contrast': ['', 'emoji-'],
  openmoji: ['', 'emoji-'],
  emojione: ['', 'emoji-'],
}

// Known direct mappings for common emojis
// This is a much smaller subset than the full mapping we had before
const KNOWN_EMOJI_NAMES: Record<string, string> = {
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
 * @param codePoint The Unicode code point as a hex string (e.g., "1f44b" for 👋)
 * @param emojiSet The emoji set to use (e.g., "noto")
 * @returns An array of possible icon names to try
 */
export function getEmojiIconNames(codePoint: string, emojiSet: string): string[] {
  // Start with prefixes for this emoji set (fallback to default if not found)
  const prefixes = EMOJI_PREFIXES[emojiSet] || EMOJI_PREFIXES.default
  
  // First, check for known mapping
  if (KNOWN_EMOJI_NAMES[codePoint]) {
    // Try both with and without emoji- prefix
    return prefixes.map(prefix => `${prefix}${KNOWN_EMOJI_NAMES[codePoint]}`)
  }
  
  // For unknown emoji, try a few standard naming conventions
  return [
    // Try direct code point (e.g., "1f44b")
    codePoint,
    // Try with u prefix (e.g., "u1f44b")
    `u${codePoint}`,
    // Try with emoji- prefix (e.g., "emoji-u1f44b")
    ...prefixes.map(prefix => `${prefix}u${codePoint}`),
  ]
}

/**
 * Gets the code point for a Unicode emoji character
 * 
 * @param emoji The emoji character (e.g., "👋")
 * @returns Hex code point (e.g., "1f44b")
 */
export function getEmojiCodePoint(emoji: string): string {
  return emoji.codePointAt(0)!.toString(16)
}