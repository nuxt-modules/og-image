import type { OgImageRenderEventContext } from '../../../../../types'
// @ts-expect-error untyped
import { icons, height as pkgHeight, width as pkgWidth } from '#og-image-virtual/iconify-json-icons.mjs'
import { getEmojiCodePoint, getEmojiIconNames } from './emoji-utils'

/**
 * Wrap gradient and filter definitions in <defs> element for better SVG renderer compatibility.
 * Resvg/satori may not recognize gradients outside of defs.
 */
function wrapDefsElements(body: string): string {
  const defsElements = ['linearGradient', 'radialGradient', 'filter', 'clipPath', 'mask', 'pattern']
  const defsRegex = new RegExp(`<(${defsElements.join('|')})[\\s\\S]*?<\\/\\1>`, 'g')

  // Check if already has defs
  if (body.includes('<defs>') || body.includes('<defs ')) {
    return body
  }

  const foundDefs: string[] = []
  const result = body.replace(defsRegex, (match) => {
    foundDefs.push(match)
    return ''
  })

  if (foundDefs.length > 0) {
    return `<defs>${foundDefs.join('')}</defs>${result}`
  }

  return body
}

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
      // Wrap gradient/filter definitions in defs for compatibility
      const body = wrapDefsElements(iconData.body || '')
      // Use icon-specific dimensions for viewBox, but 1em for sizing to behave like inline text
      const width = iconData.width || pkgWidth || 128
      const height = iconData.height || pkgHeight || 128
      // Use 1em sizing and inline-block display for proper satori layout (matches build-time transform)
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="1em" height="1em" style="display:inline-block;vertical-align:middle">${body}</svg>`
    }
  }
  return null
}
