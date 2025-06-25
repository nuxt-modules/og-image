import type { OgImageRenderEventContext } from '../../../../../types'
import { createRequire } from 'node:module'
import { emojiCache } from '#og-image-cache'
import { getEmojiCodePoint, getEmojiIconNames } from './emoji-map'

/**
 * Service function to get emoji SVGs from local iconify JSON files
 * This does not perform HTML replacement - that's handled by the AST plugin
 * This implementation prioritizes local deps over API calls (addresses issue #354)
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

  // If not in cache, try to load from local iconify dependency first (issue #354)
  if (!svg) {
    try {
      const require = createRequire(import.meta.url)
      const iconifyJsonPackage = `@iconify-json/${ctx.options.emojis}`
      const iconSet = require(`${iconifyJsonPackage}/icons.json`)

      if (iconSet && iconSet.icons) {
        // Try each possible name until we find a match
        for (const iconName of possibleNames) {
          if (iconSet.icons[iconName]) {
            // Generate SVG from the icon data
            const iconData = iconSet.icons[iconName]
            const body = iconData.body || ''
            const width = iconData.width || iconSet.width || '16'
            const height = iconData.height || iconSet.height || '16'

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
      // If we can't find the icon locally, return null (don't fallback to API here)
      return null
    }
  }

  if (svg) {
    return (svg as string).replace('<svg ', '<svg data-emoji style="margin: 0 .05em 0 .15em; vertical-align: -0.1em;" ')
  }

  return null
}
