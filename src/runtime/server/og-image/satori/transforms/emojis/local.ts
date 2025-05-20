import type { OgImageRenderEventContext } from '../../../../../types'
import type { NuxtIslandResponse } from './types'
import { createRequire } from 'node:module'
import { emojiCache } from '#og-image-cache'
import {getEmojiCodePoint, getEmojiIconNames, getEmojiUtils} from './emoji-map'
import { RE_MATCH_EMOJIS } from './index'

/**
 * Transform that uses local iconify JSON files to generate emoji SVGs
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

  const utils = await getEmojiUtils()
  const icons = await import(`@iconify-json/${ctx.options.emojis}`)

  const require = createRequire(import.meta.url)
  const iconifyJsonPackage =
  const iconSet = require(`${iconifyJsonPackage}/icons.json`)

  const replacements = await Promise.all(matches.map(async (match: string) => {
    // Get the code point and possible icon names
    const codePoint = getEmojiCodePoint(match)
    const possibleNames = utils.getEmojiIconNames(codePoint, ctx.options.emojis!)

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

    // If not in cache, try to load from local iconify dependency
    if (!svg) {
      try {

        if (iconSet && iconSet.icons) {
          // Try each possible name until we find a match
          for (const iconName of possibleNames) {
            if (iconSet.icons[iconName]) {
              // Generate SVG from the icon data
              const iconData = iconSet.icons[iconName]
              const body = iconData.body || ''
              const width = iconData.width || '16'
              const height = iconData.height || '16'

              svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body}</svg>`

              // Cache this successful match
              if (svg) {
                const key = ['1', ctx.options.emojis, iconName].join(':')
                await emojiCache.setItem(key, svg as string)
                break
              }
            }
          }
        }
      }
      catch {
        return match
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
