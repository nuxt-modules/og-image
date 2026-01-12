import type { IconifyJSON } from '@iconify/types'
import MagicString from 'magic-string'
import { createUnplugin } from 'unplugin'
import { getEmojiCodePoint, getEmojiIconNames, RE_MATCH_EMOJIS } from '../runtime/server/og-image/satori/transforms/emojis/emoji-utils'

let emojiCounter = 0

function wrapDefsElements(body: string): string {
  const defsElements = ['linearGradient', 'radialGradient', 'filter', 'clipPath', 'mask', 'pattern']
  const defsRegex = new RegExp(`<(${defsElements.join('|')})[\\s\\S]*?<\\/\\1>`, 'g')

  if (body.includes('<defs>') || body.includes('<defs '))
    return body

  const foundDefs: string[] = []
  const result = body.replace(defsRegex, (match) => {
    foundDefs.push(match)
    return ''
  })

  if (foundDefs.length > 0)
    return `<defs>${foundDefs.join('')}</defs>${result}`

  return body
}

function makeIdsUnique(svg: string): string {
  const prefix = `be${emojiCounter++}_`
  const ids = new Set<string>()
  svg.replace(/\bid="([^"]+)"/g, (_, id) => {
    ids.add(id)
    return ''
  })

  let result = svg
  for (const id of ids) {
    result = result
      .replace(new RegExp(`id="${id}"`, 'g'), `id="${prefix}${id}"`)
      .replace(new RegExp(`url\\(#${id}\\)`, 'g'), `url(#${prefix}${id})`)
      .replace(new RegExp(`href="#${id}"`, 'g'), `href="#${prefix}${id}"`)
  }
  return result
}

function buildEmojiSvg(emoji: string, icons: IconifyJSON): string | null {
  const codePoint = getEmojiCodePoint(emoji)
  // Use noto as default since that's what module defaults to
  const possibleNames = getEmojiIconNames(codePoint, 'noto')

  for (const iconName of possibleNames) {
    const iconData = icons.icons?.[iconName]
    if (iconData) {
      const body = wrapDefsElements(iconData.body || '')
      const width = iconData.width || icons.width || 128
      const height = iconData.height || icons.height || 128
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="1em" height="1em" style="display:inline-block;vertical-align:middle">${body}</svg>`
      svg = makeIdsUnique(svg)
      return svg
    }
  }
  return null
}

export interface EmojiTransformOptions {
  emojiSet: string
  componentDirs: string[]
}

export const emojiTransformPlugin = createUnplugin((options: EmojiTransformOptions) => {
  let icons: IconifyJSON | null = null

  return {
    name: 'nuxt-og-image:emoji-transform',
    enforce: 'pre',

    transformInclude(id) {
      // Only process OG Image components in configured directories
      return options.componentDirs.some(dir => id.includes(dir))
        && id.endsWith('.vue')
        && !id.includes('node_modules')
    },

    async transform(code, _id) {
      // Quick check - skip if no emojis
      if (!RE_MATCH_EMOJIS.test(code))
        return

      // Lazy load iconify JSON at build time
      if (!icons) {
        icons = await import(`@iconify-json/${options.emojiSet}/icons.json`, {
          with: { type: 'json' },
        }).then(m => m.default).catch(() => null)

        if (!icons)
          return
      }
      const loadedIcons = icons

      // Find template section
      const templateMatch = code.match(/<template>([\s\S]*?)<\/template>/)
      if (!templateMatch)
        return

      const s = new MagicString(code)
      const templateStart = code.indexOf('<template>') + '<template>'.length
      const templateEnd = code.indexOf('</template>')
      const template = code.slice(templateStart, templateEnd)

      // Reset regex state
      RE_MATCH_EMOJIS.lastIndex = 0

      // Only replace emojis in text content (between tags), not in attributes
      // Match text content: content between > and < that's not inside a tag
      let newTemplate = template
      let hasChanges = false

      // Replace emojis only in text content (between > and <)
      newTemplate = newTemplate.replace(/>([^<]*)</g, (fullMatch, textContent) => {
        if (!textContent)
          return fullMatch

        RE_MATCH_EMOJIS.lastIndex = 0
        const emojiMatches = [...textContent.matchAll(RE_MATCH_EMOJIS)]
        if (!emojiMatches.length)
          return fullMatch

        let newTextContent = textContent
        for (const match of emojiMatches) {
          const emoji = match[0]
          const svg = buildEmojiSvg(emoji, loadedIcons)
          if (svg) {
            hasChanges = true
            const escaped = emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            newTextContent = newTextContent.replace(new RegExp(escaped, 'g'), svg)
          }
        }
        return `>${newTextContent}<`
      })

      if (!hasChanges)
        return

      s.overwrite(templateStart, templateEnd, newTemplate)

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      }
    },
  }
})
