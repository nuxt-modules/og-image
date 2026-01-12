import type { OgImageRenderEventContext } from '../../../../../types'
// @ts-expect-error untyped
import { icons } from '#og-image-virtual/iconify-json-icons.mjs'
import { getEmojiCodePoint, getEmojiIconNames } from './emoji-utils'

/**
 * Service function to get emoji SVGs from local iconify JSON files
 * This does not perform HTML replacement - that's handled by the AST plugin
 * This implementation prioritizes local deps over API calls (addresses issue #354)
 */
export async function getEmojiSvg(ctx: OgImageRenderEventContext, emojiChar: string): Promise<string | null> {
  const codePoint = getEmojiCodePoint(emojiChar)
  const possibleNames = getEmojiIconNames(codePoint, ctx.options.emojis!)

  // Try each possible name until we find a match
  for (const iconName of possibleNames) {
    if (icons[iconName]) {
      const iconData = icons[iconName]
      const body = iconData.body || ''
      const width = iconData.width || '16'
      const height = iconData.height || '16'
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body}</svg>`
    }
  }
  return null
}
