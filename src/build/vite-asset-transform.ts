import type { IconifyJSON } from '@iconify/types'
import type { CssProvider } from './css/css-provider'
import { readFile } from 'node:fs/promises'
import MagicString from 'magic-string'
import { ofetch } from 'ofetch'
import { dirname, isAbsolute, join, resolve } from 'pathe'
import { createUnplugin } from 'unplugin'
import { logger } from '../runtime/logger'
import { getEmojiCodePoint, getEmojiIconNames, RE_MATCH_EMOJIS } from '../runtime/server/og-image/satori/transforms/emojis/emoji-utils'
import { resolveClassesToStyles } from './css/providers/tw4'
import { transformVueTemplate } from './vue-template-transform'

let svgCounter = 0

// SVG utilities (shared across icons and emojis)
function makeIdsUnique(svg: string): string {
  const prefix = `og${svgCounter++}_`
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

// Icon utilities
function buildIconSvg(iconData: { body: string, width?: number, height?: number }, defaultWidth: number, defaultHeight: number, attrs: string): string {
  const body = wrapDefsElements(iconData.body || '')
  const width = iconData.width || defaultWidth
  const height = iconData.height || defaultHeight

  const attrPairs = attrs.matchAll(/(\w+(?:-\w+)*)="([^"]*)"/g)
  const filteredAttrs: string[] = []
  let existingStyle = ''
  for (const [, key, value] of attrPairs) {
    if (key === 'name')
      continue
    if (key === 'style' && value) {
      existingStyle = value
      continue
    }
    filteredAttrs.push(`${key}="${value}"`)
  }
  // Merge existing style with display:flex
  const mergedStyle = existingStyle ? `display:flex; ${existingStyle}` : 'display:flex'
  const attrsStr = filteredAttrs.length > 0 ? ` ${filteredAttrs.join(' ')}` : ''

  let svg = `<span${attrsStr} style="${mergedStyle}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" fill="currentColor">${body}</svg></span>`
  svg = makeIdsUnique(svg)
  return svg
}

const iconCache = new Map<string, IconifyJSON | null>()

async function loadIconSet(prefix: string): Promise<IconifyJSON | null> {
  if (iconCache.has(prefix))
    return iconCache.get(prefix)!

  const icons = await import(`@iconify-json/${prefix}/icons.json`, {
    with: { type: 'json' },
  }).then(m => m.default).catch(() => null)

  iconCache.set(prefix, icons)
  return icons
}

// Emoji utilities
function buildEmojiSvg(emoji: string, icons: IconifyJSON, emojiSet: string): string | null {
  const codePoint = getEmojiCodePoint(emoji)
  const possibleNames = getEmojiIconNames(codePoint, emojiSet)

  for (const iconName of possibleNames) {
    const iconData = icons.icons?.[iconName]
    if (iconData) {
      const body = wrapDefsElements(iconData.body || '')
      const width = iconData.width || icons.width || 128
      const height = iconData.height || icons.height || 128
      let svg = `<span style="display:flex"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="1em" height="1em">${body}</svg></span>`
      svg = makeIdsUnique(svg)
      return svg
    }
  }
  return null
}

// Fetch emoji from Iconify API (build-time fallback when local icons not installed)
const emojiFetchCache = new Map<string, string | null>()
async function fetchEmojiSvg(emoji: string, emojiSet: string): Promise<string | null> {
  const cacheKey = `${emojiSet}:${emoji}`
  if (emojiFetchCache.has(cacheKey))
    return emojiFetchCache.get(cacheKey)!

  const codePoint = getEmojiCodePoint(emoji)
  const possibleNames = getEmojiIconNames(codePoint, emojiSet)

  for (const iconName of possibleNames) {
    try {
      const svg = await ofetch(`https://api.iconify.design/${emojiSet}/${iconName}.svg`, {
        responseType: 'text',
        retry: 1,
      })
      // Iconify API returns '404' text for missing icons
      if (svg && svg !== '404') {
        // Extract viewBox and body from fetched SVG, build our own wrapper
        const viewBoxMatch = svg.match(/viewBox="([^"]*)"/)
        const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 128 128'
        const bodyMatch = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/)
        const body = bodyMatch ? bodyMatch[1] : ''
        let result = `<span style="display:flex"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="1em" height="1em">${body}</svg></span>`
        result = makeIdsUnique(result)
        emojiFetchCache.set(cacheKey, result)
        return result
      }
    }
    catch {
      // Continue to next name
    }
  }

  emojiFetchCache.set(cacheKey, null)
  return null
}

// Image utilities
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

// Satori unsupported utility patterns - filtered at build time
// Reference: https://github.com/vercel/satori#css
const SATORI_UNSUPPORTED_PATTERNS = [
  /^z-/, // z-index not supported by Satori
  /^ring(-|$)/, // Ring utilities - not supported
  /^divide(-|$)/, // Divide utilities - not supported
  /^space-(x|y)(-|$)/, // Space utilities - use gap instead
  /^backdrop-/, // Backdrop utilities - not supported
  // Note: filter utilities (blur, brightness, etc.) ARE supported by Satori
  // Note: skew transforms ARE supported by Satori
  /^transition(-|$)/, // Animation (static image)
  /^animate(-|$)/,
  /^duration(-|$)/,
  /^ease(-|$)/,
  /^delay(-|$)/,
  /^scroll(-|$)/, // Scroll utilities
  /^snap(-|$)/,
  /^touch(-|$)/, // Touch/pointer
  /^pointer-events(-|$)/,
  /^cursor(-|$)/,
  /^select(-|$)/, // User select
  /^will-change(-|$)/,
  /^placeholder(-|$)/,
  /^caret(-|$)/,
  /^accent(-|$)/,
  /^columns(-|$)/,
  /^break-(before|after|inside)(-|$)/,
  /^hyphens(-|$)/,
  /^content-(?!center|start|end|between|around|evenly|stretch)/, // content-* except flex alignment
]

function isSatoriUnsupported(cls: string): boolean {
  return SATORI_UNSUPPORTED_PATTERNS.some(p => p.test(cls))
}

export interface AssetTransformOptions {
  /** Resolved absolute paths to OG component directories */
  ogComponentPaths: string[]
  rootDir: string
  srcDir: string
  publicDir: string
  emojiSet?: string
  /** Pre-loaded emoji icon set (skips dynamic import) */
  emojiIcons?: IconifyJSON | null
  /**
   * CSS provider for resolving utility classes (UnoCSS, etc.)
   * When set, used instead of TW4-specific style map.
   */
  cssProvider?: CssProvider
  /**
   * Prebuilt TW4 style map: className -> { prop: value }
   * Generated at build time from scanning all OG components
   */
  tw4StyleMap?: Record<string, Record<string, string>>
  /**
   * Lazy TW4 initializer - called on first transform to populate style map.
   */
  initTw4?: () => Promise<void>
  /**
   * Path to Tailwind CSS file for gradient resolution.
   */
  tw4CssPath?: string
  /**
   * Lazy loader for Nuxt UI colors from .nuxt/app.config.mjs.
   */
  loadNuxtUiColors?: () => Promise<Record<string, string> | undefined>
}

export const AssetTransformPlugin = createUnplugin((options: AssetTransformOptions) => {
  let emojiIcons: IconifyJSON | null = null

  return {
    name: 'nuxt-og-image:asset-transform',
    enforce: 'pre',

    transformInclude(id) {
      if (!id.endsWith('.vue') || id.includes('node_modules'))
        return false
      // Check if file is inside any of the resolved OG component directories
      return options.ogComponentPaths.some(dir => id.startsWith(`${dir}/`) || id.startsWith(`${dir}\\`))
    },

    async transform(code, id) {
      const templateMatch = code.match(/<template>([\s\S]*?)<\/template>/)
      if (!templateMatch)
        return

      const s = new MagicString(code)
      const templateStart = code.indexOf('<template>') + '<template>'.length
      const templateEnd = code.indexOf('</template>')
      let template = code.slice(templateStart, templateEnd)
      let hasChanges = false

      // Transform emojis in text content
      if (options.emojiSet && RE_MATCH_EMOJIS.test(template)) {
        // Try local icons first, fallback to fetch
        if (!emojiIcons) {
          emojiIcons = options.emojiIcons ?? await import(`@iconify-json/${options.emojiSet}/icons.json`, {
            with: { type: 'json' },
          }).then(m => m.default).catch(() => null)
        }

        // Collect all unique emojis in template
        RE_MATCH_EMOJIS.lastIndex = 0
        const allEmojis = new Set<string>()
        for (const match of template.matchAll(RE_MATCH_EMOJIS)) {
          allEmojis.add(match[0])
        }

        // Resolve emoji SVGs in parallel (local first, fetch fallback)
        const emojiSvgMap = new Map<string, string>()
        await Promise.all([...allEmojis].map(async (emoji) => {
          let svg: string | null = null
          if (emojiIcons) {
            svg = buildEmojiSvg(emoji, emojiIcons, options.emojiSet!)
          }
          if (!svg) {
            svg = await fetchEmojiSvg(emoji, options.emojiSet!)
          }
          if (svg) {
            emojiSvgMap.set(emoji, svg)
          }
        }))

        // Replace emojis with resolved SVGs
        if (emojiSvgMap.size > 0) {
          template = template.replace(/>([^<]*)</g, (fullMatch, textContent) => {
            if (!textContent)
              return fullMatch

            RE_MATCH_EMOJIS.lastIndex = 0
            const emojiMatches = [...textContent.matchAll(RE_MATCH_EMOJIS)]
            if (!emojiMatches.length)
              return fullMatch

            let newTextContent = textContent
            for (const match of emojiMatches) {
              const emoji = match[0]
              const svg = emojiSvgMap.get(emoji)
              if (svg) {
                hasChanges = true
                const escaped = emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                newTextContent = newTextContent.replace(new RegExp(escaped, 'g'), svg)
              }
            }
            return `>${newTextContent}<`
          })
        }
      }

      // Transform icons: <Icon name="..." /> or <UIcon name="..." />
      // Safe: uses non-greedy .*? with atomic grouping via split matching
      const iconRegex = /<(Icon|UIcon)\s[^>]*?name="([^"]+)"[^>]*>/g
      if (iconRegex.test(template)) {
        iconRegex.lastIndex = 0

        const prefixes = new Set<string>()
        let match
        // eslint-disable-next-line no-cond-assign
        while ((match = iconRegex.exec(template)) !== null) {
          const iconName = match[2]
          if (!iconName || iconName.includes('{'))
            continue
          const [prefix] = iconName.split(':')
          if (prefix)
            prefixes.add(prefix)
        }

        const iconSets = new Map<string, IconifyJSON>()
        for (const prefix of prefixes) {
          const icons = await loadIconSet(prefix)
          if (icons)
            iconSets.set(prefix, icons)
        }

        if (iconSets.size > 0) {
          iconRegex.lastIndex = 0
          template = template.replace(iconRegex, (fullMatch, _tag, attrs, iconName) => {
            if (!iconName || iconName.includes('{'))
              return fullMatch

            const [prefix, name] = iconName.split(':')
            if (!prefix || !name)
              return fullMatch

            const icons = iconSets.get(prefix)
            if (!icons)
              return fullMatch

            const iconData = icons.icons?.[name]
            if (!iconData)
              return fullMatch

            hasChanges = true
            return buildIconSvg(iconData, icons.width || 24, icons.height || 24, attrs)
          })
        }
      }

      // Transform CSS utility classes to inline styles
      // Use cssProvider (UnoCSS) if available, otherwise fall back to TW4 style map
      const hasCssProvider = options.cssProvider

      // Lazy init TW4 on first transform (only when no cssProvider)
      if (!hasCssProvider && options.initTw4)
        await options.initTw4()

      // Check style map AFTER initTw4 completes (it populates the map)
      const hasTw4StyleMap = options.tw4StyleMap && Object.keys(options.tw4StyleMap).length > 0

      if (hasCssProvider || hasTw4StyleMap) {
        try {
          const styleMap = options.tw4StyleMap || {}

          // Wrap current template back into full SFC for AST parsing
          const fullCode = code.slice(0, templateStart) + template + code.slice(templateEnd)

          // Check if we have gradient classes that need combination logic (TW4 only)
          const hasGradientClasses = !hasCssProvider && options.tw4CssPath && (
            template.includes('bg-gradient') || template.includes('bg-radial')
            || template.includes('from-') || template.includes('to-') || template.includes('via-')
          )

          const result = await transformVueTemplate(fullCode, {
            resolveStyles: async (classes) => {
              // Filter unsupported classes first
              const supported = classes.filter(cls => !isSatoriUnsupported(cls))
              const unsupported = classes.filter(cls => isSatoriUnsupported(cls))

              if (unsupported.length > 0) {
                const componentName = id.split('/').pop()
                logger.warn(`[nuxt-og-image] ${componentName}: Filtered unsupported Satori classes: ${unsupported.join(', ')}`)
              }

              // Use CSS provider (UnoCSS) when available
              if (options.cssProvider) {
                return options.cssProvider.resolveClassesToStyles(supported)
              }

              // Use full resolution with gradient combination logic when gradient classes present
              if (hasGradientClasses && options.tw4CssPath) {
                const hasElementGradient = supported.some(c =>
                  c.startsWith('bg-gradient') || c.startsWith('bg-radial')
                  || c.startsWith('from-') || c.startsWith('to-') || c.startsWith('via-'),
                )

                if (hasElementGradient) {
                  // Use resolveClassesToStyles which handles gradient combination
                  const nuxtUiColors = await options.loadNuxtUiColors?.()
                  return resolveClassesToStyles(supported, {
                    cssPath: options.tw4CssPath,
                    nuxtUiColors,
                  })
                }
              }

              // Simple map lookup for non-gradient classes
              const resolved: Record<string, Record<string, string>> = {}
              for (const cls of supported) {
                // Handle responsive prefixes: extract base class
                const baseClass = cls.replace(/^(sm|md|lg|xl|2xl):/, '')
                if (styleMap[baseClass]) {
                  resolved[cls] = styleMap[baseClass]
                }
                else if (styleMap[cls]) {
                  resolved[cls] = styleMap[cls]
                }
                // Classes not in map will be kept in class attr for Satori's tw prop
              }
              return resolved
            },
          })

          if (result) {
            // Extract the transformed template
            const newTemplateStart = result.code.indexOf('<template>') + '<template>'.length
            const newTemplateEnd = result.code.indexOf('</template>')
            template = result.code.slice(newTemplateStart, newTemplateEnd)
            hasChanges = true
          }
        }
        catch (err) {
          const componentName = id.split('/').pop()
          logger.warn(`[nuxt-og-image] ${componentName}: TW4 template transform failed, using original template`, (err as Error).message)
          // Continue without TW4 transforms - Satori will try to handle classes via tw prop
        }
      }

      // Transform images: src="/path" or src="~/path" or src="@/path"
      if (!template.includes('data-no-inline')) {
        const imgRegex = /(?<!:)src="((?:\/|~\/|@\/)[^"]+\.(png|jpg|jpeg|gif|webp|svg))"/g
        if (imgRegex.test(template)) {
          imgRegex.lastIndex = 0

          const componentDir = dirname(id)
          const replacements: Array<{ from: string, to: string }> = []

          let match
          // eslint-disable-next-line no-cond-assign
          while ((match = imgRegex.exec(template)) !== null) {
            const [fullMatch, srcPath, ext] = match
            if (!srcPath || !ext)
              continue

            if (srcPath.startsWith('data:') || srcPath.startsWith('http'))
              continue

            let resolvedPath: string
            if (srcPath.startsWith('/')) {
              resolvedPath = join(options.publicDir, srcPath)
            }
            else if (srcPath.startsWith('~/') || srcPath.startsWith('@/')) {
              resolvedPath = join(options.srcDir, srcPath.slice(2))
            }
            else if (!isAbsolute(srcPath)) {
              resolvedPath = resolve(componentDir, srcPath)
            }
            else {
              continue
            }

            const fileBuffer = await readFile(resolvedPath).catch(() => null)
            if (!fileBuffer)
              continue

            const mimeType = getMimeType(ext)
            let dataUri: string
            if (ext === 'svg') {
              const svgContent = fileBuffer.toString('utf-8')
              dataUri = `data:${mimeType},${encodeURIComponent(svgContent)}`
            }
            else {
              const base64 = fileBuffer.toString('base64')
              dataUri = `data:${mimeType};base64,${base64}`
            }

            replacements.push({ from: fullMatch, to: `src="${dataUri}"` })
            hasChanges = true
          }

          for (const { from, to } of replacements) {
            template = template.replace(from, to)
          }
        }
      }

      if (!hasChanges)
        return

      s.overwrite(templateStart, templateEnd, template)

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      }
    },
  }
})
