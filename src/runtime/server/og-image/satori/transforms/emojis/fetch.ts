import type { OgImageRenderEventContext } from '../../../../../types'
import type { NuxtIslandResponse } from './types'
import { emojiCache } from '#og-image-cache'
import { $fetch } from 'ofetch'
import { getEmojiCodePoint, getEmojiIconNames } from './emoji-map'
import { RE_MATCH_EMOJIS } from './index'

/**
 * Transform that fetches emoji SVGs from the iconify API
 * Optimized to early-return when no emojis are present
 */
export async function applyEmojis(ctx: OgImageRenderEventContext, island: NuxtIslandResponse) {
  // Quick check if there might be any emojis in the content
  // This helps avoid unnecessary regex matching for content without emojis
  if (!island.html.match(/[\u{1F000}-\u{1FFFF}\p{Emoji}]/u)) {
    return false
  }

  const html = island.html
  const matches = html.match(RE_MATCH_EMOJIS)
  if (!matches?.length)
    return false

  const replacements = await Promise.all(matches.map(async (match: string) => {
    // Get the code point and possible icon names
    const codePoint = getEmojiCodePoint(match)
    const possibleNames = await getEmojiIconNames(codePoint, ctx.options.emojis)

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
    if (svg)
      return `\n${(svg as string).replace('<svg ', '<svg data-emoji style="margin: 0 .05em 0 .15em; vertical-align: -0.1em;" ')}\n`
    return match
  }))

  // apply replacements to matched html
  const finalHtml = html.replace(RE_MATCH_EMOJIS, () => replacements.shift()!)
  const modified = finalHtml !== island.html
  island.html = finalHtml
  return modified
}
