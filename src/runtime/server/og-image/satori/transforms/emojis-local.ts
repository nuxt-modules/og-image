import type { NuxtIslandResponse } from 'nuxt/dist/core/runtime/nitro/renderer'
import type { OgImageRenderEventContext } from '../../../../types'
import { emojiCache } from '#og-image-cache'
import { createRequire } from 'node:module'
import { RE_MATCH_EMOJIS } from './emojis'
import { getEmojiCodePoint, getEmojiIconNames } from './emoji-map'

/**
 * Transform that uses local iconify JSON files to generate emoji SVGs
 */
export async function applyEmojis(ctx: OgImageRenderEventContext, island: NuxtIslandResponse) {
  const html = island.html
  const matches = html.match(RE_MATCH_EMOJIS)
  if (!matches?.length)
    return false

  const replacements = await Promise.all(matches.map(async (match) => {
    // Get the code point and possible icon names
    const codePoint = getEmojiCodePoint(match)
    const possibleNames = getEmojiIconNames(codePoint, ctx.options.emojis)
    
    // Try cache first with any of the possible names
    let svg = null
    for (const iconName of possibleNames) {
      const key = ['1', ctx.options.emojis, iconName].join(':')
      if (await emojiCache.hasItem(key)) {
        svg = await emojiCache.getItem(key)
        if (svg) break
      }
    }
    
    // If not in cache, try to load from local iconify dependency
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
      } catch (e) {
        // If we can't find the icon, return the original match
        console.debug(`Failed to load emoji from local dependency: ${e}`)
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