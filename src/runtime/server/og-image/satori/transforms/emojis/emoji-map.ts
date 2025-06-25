/**
 * Emoji Unicode to name mapping utilities
 *
 * This file provides a thin wrapper around the actual emoji utilities
 * that are dynamically imported only when needed. This significantly
 * reduces initial bundle size and memory usage when no emojis are present.
 */

// Function to dynamically import the emoji utility module
let emojiUtilsPromise: Promise<typeof import('./emoji-utils')> | null = null

/**
 * Ensures the emoji utilities are loaded
 * @returns Promise that resolves to the emoji utilities module
 */
export async function getEmojiUtils() {
  if (!emojiUtilsPromise) {
    // Only import the module once and cache the promise
    emojiUtilsPromise = import('./emoji-utils')
  }
  return emojiUtilsPromise
}

/**
 * Gets possible Iconify icon names for a given Unicode emoji
 *
 * @param codePoint The Unicode code point as a hex string (e.g., "1f44b" for 👋)
 * @param emojiSet The emoji set to use (e.g., "noto")
 * @returns An array of possible icon names to try
 */
export async function getEmojiIconNames(codePoint: string, emojiSet: string): Promise<string[]> {
  const emojiUtils = await getEmojiUtils()
  return emojiUtils.getEmojiIconNames(codePoint, emojiSet)
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
