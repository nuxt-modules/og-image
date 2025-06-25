import type { OgImageRenderEventContext } from '../../../../../types'
import { emojiCache } from '#og-image-cache'
import { $fetch } from 'ofetch'
import { getEmojiCodePoint, getEmojiIconNames } from './emoji-map'

/**
 * Service function to fetch emoji SVGs from the iconify API
 * This does not perform HTML replacement - that's handled by the AST plugin
 */
export async function getEmojiSvg(ctx: OgImageRenderEventContext, emojiChar: string): Promise<string | null> {
  const codePoint = getEmojiCodePoint(emojiChar)
  const possibleNames = await getEmojiIconNames(codePoint, ctx.options.emojis!)

  // Try cache first with any of the possible names
  let svg = null
  for (const iconName of possibleNames) {
    const key = ['1', ctx.options.emojis, iconName].join(':')
    if (await emojiCache.hasItem(key)) {
      svg = await emojiCache.getItem(key)
      if (svg)
        break
    }
  }

  // If not in cache, try API calls
  if (!svg) {
    // Try each possible name with the API
    for (const iconName of possibleNames) {
      try {
        svg = await $fetch(`https://api.iconify.design/${ctx.options.emojis}/${iconName}.svg`, {
          responseType: 'text',
          retry: 2,
          retryDelay: 500,
        })

        // If we got a valid SVG
        if (svg && svg !== '404') {
          // Cache this successful match
          const key = ['1', ctx.options.emojis, iconName].join(':')
          await emojiCache.setItem(key, svg as string)
          break
        }
      }
      catch {
        // Continue to the next name if this one fails
        svg = null
      }
    }
  }

  if (svg) {
    return (svg as string).replace('<svg ', '<svg data-emoji style="margin: 0 .05em 0 .15em; vertical-align: -0.1em;" ')
  }

  return null
}
