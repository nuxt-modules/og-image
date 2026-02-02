import type { OgImageRenderEventContext } from '../../../../../types'
import { useNitroApp } from 'nitropack/runtime'
import { getEmojiCodePoint, getEmojiIconNames } from './emoji-utils'

interface IconsData { icons: Record<string, { body: string, width?: number, height?: number }>, width: number, height: number }

declare module '#og-image-virtual/iconify-json-icons.mjs' {
  export function loadIcons(): Promise<IconsData>
}

declare module 'nitropack/types' {
  interface NitroApp {
    _ogImageIconsData?: IconsData
  }
}

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
 * Icons are loaded lazily on first use to avoid 24MB+ memory at startup
 */
export async function getEmojiSvg(ctx: OgImageRenderEventContext, emojiChar: string): Promise<string | null> {
  // Lazy load icons on first use - cached on nitro app instance
  const nitroApp = useNitroApp()
  if (!nitroApp._ogImageIconsData) {
    const { loadIcons } = await import('#og-image-virtual/iconify-json-icons.mjs')
    nitroApp._ogImageIconsData = await loadIcons()
  }

  const { icons, width: pkgWidth, height: pkgHeight } = nitroApp._ogImageIconsData
  const codePoint = getEmojiCodePoint(emojiChar)
  const possibleNames = getEmojiIconNames(codePoint, ctx.options.emojis as string)

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
