/**
 * Regular expression to match emoji characters.
 *
 * \p{Emoji_Presentation} - Matches characters that have emoji presentation by default
 * \p{Extended_Pictographic} - Matches characters that are pictographic or emoji-like
 *
 * These are Unicode property escapes defined in the Unicode Standard:
 * - Emoji_Presentation indicates characters that should be rendered as emoji by default
 * - Extended_Pictographic includes all emoji characters and future emoji code points
 */
export const RE_MATCH_EMOJIS = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu

// Re-export from the implementation determined at build time
export { applyEmojis } from '#og-image/emoji-transform'

// Export the emoji utility functions
export * from './emoji-map'
export * from './types'
