import type { NuxtIslandResponse } from 'nuxt/app'
import type { OgImageRenderEventContext } from '../../../../../types'
import { getEmojiSvg } from '#og-image/emoji-transform'
import { RE_MATCH_EMOJIS } from './emoji-utils'

let emojiCounter = 0

/**
 * Wrap gradient and filter definitions in <defs> element for better SVG renderer compatibility.
 * Some renderers (like resvg used by satori) may not recognize gradients outside of defs.
 */
function wrapDefsElements(svg: string): string {
  // Find all gradient and filter elements that aren't already in defs
  const defsElements = ['linearGradient', 'radialGradient', 'filter', 'clipPath', 'mask', 'pattern']
  const defsRegex = new RegExp(`<(${defsElements.join('|')})[\\s\\S]*?<\\/\\1>`, 'g')

  // Check if already has defs
  if (svg.includes('<defs>') || svg.includes('<defs ')) {
    return svg
  }

  const foundDefs: string[] = []
  let result = svg.replace(defsRegex, (match) => {
    foundDefs.push(match)
    return ''
  })

  if (foundDefs.length > 0) {
    // Insert defs after the opening svg tag
    const svgTagEnd = result.indexOf('>') + 1
    result = `${result.slice(0, svgTagEnd)}<defs>${foundDefs.join('')}</defs>${result.slice(svgTagEnd)}`
  }

  return result
}

/**
 * Make SVG IDs unique to prevent collisions when multiple emoji SVGs are in the same document.
 */
function makeIdsUnique(svg: string): string {
  const prefix = `e${emojiCounter++}_`
  // Find all id="..." and replace with unique prefixed versions
  const ids = new Set<string>()
  svg.replace(/\bid="([^"]+)"/g, (_, id) => {
    ids.add(id)
    return ''
  })

  let result = svg
  for (const id of ids) {
    // Replace id definitions and references
    result = result
      .replace(new RegExp(`id="${id}"`, 'g'), `id="${prefix}${id}"`)
      .replace(new RegExp(`url\\(#${id}\\)`, 'g'), `url(#${prefix}${id})`)
      .replace(new RegExp(`href="#${id}"`, 'g'), `href="#${prefix}${id}"`)
  }
  return result
}

/**
 * Apply emoji transformations to island HTML content.
 * Replaces emoji characters with inline SVG elements.
 */
export async function applyEmojis(ctx: OgImageRenderEventContext, island: NuxtIslandResponse): Promise<void> {
  if (!island.html || !ctx.options.emojis)
    return

  const matches = [...island.html.matchAll(RE_MATCH_EMOJIS)]
  if (!matches.length)
    return

  // Build a map of emoji -> svg to avoid duplicate fetches
  const emojiToSvg = new Map<string, string | null>()

  // Fetch all unique emojis
  const uniqueEmojis = [...new Set(matches.map(m => m[0]))]
  await Promise.all(uniqueEmojis.map(async (emoji) => {
    let svg = await getEmojiSvg(ctx, emoji)
    if (svg) {
      // Make IDs unique to prevent collisions in the document
      svg = makeIdsUnique(svg)
      // Wrap gradient/filter definitions in <defs> for better compatibility
      svg = wrapDefsElements(svg)
    }
    emojiToSvg.set(emoji, svg ?? null)
  }))

  // Replace emojis only in text content (between > and <), not in attributes
  // This is important to avoid breaking alt attributes or other attribute values
  let html = island.html
  html = html.replace(/>([^<]*)</g, (fullMatch, textContent) => {
    if (!textContent)
      return fullMatch

    let newTextContent = textContent
    for (const [emoji, svg] of emojiToSvg) {
      if (svg) {
        // Escape special regex characters in the emoji
        const escaped = emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        newTextContent = newTextContent.replace(new RegExp(escaped, 'g'), svg)
      }
    }
    return `>${newTextContent}<`
  })

  island.html = html
}
