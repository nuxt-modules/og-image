import type { IconifyJSON } from '@iconify/types'
import type { ElementNode, Node } from 'ultrahtml'
import type { CssProvider } from './css/css-provider'
import { readFile } from 'node:fs/promises'
import { parse as parseSfc } from '@vue/compiler-sfc'
import MagicString from 'magic-string'
import { ofetch } from 'ofetch'
import { dirname, isAbsolute, join, resolve } from 'pathe'
import { ELEMENT_NODE, parse as parseHtml, renderSync, walkSync } from 'ultrahtml'
import { createUnplugin } from 'unplugin'
import { logger } from '../runtime/logger'
import { getEmojiCodePoint, getEmojiIconNames, RE_MATCH_EMOJIS } from '../runtime/server/og-image/satori/transforms/emojis/emoji-utils'
import { extractFontRequirementsFromVue } from './css/css-classes'
import { extractClassStyles, resolveCssVars, simplifyCss } from './css/css-utils'
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
function buildIconSvg(iconData: { body: string, width?: number, height?: number }, defaultWidth: number, defaultHeight: number, attrs: Record<string, string>): string {
  const body = wrapDefsElements(iconData.body || '')
  const width = iconData.width || defaultWidth
  const height = iconData.height || defaultHeight

  // Filter attrs and extract style
  const filteredAttrs: string[] = []
  let existingStyle = ''
  for (const [key, value] of Object.entries(attrs)) {
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
   * CSS provider for resolving utility classes (TW4, UnoCSS, etc.)
   */
  cssProvider?: CssProvider
  /**
   * Callback invoked after extracting font requirements from each component.
   */
  onFontRequirements?: (id: string, reqs: Awaited<ReturnType<typeof extractFontRequirementsFromVue>>) => void
}

export const AssetTransformPlugin = createUnplugin((options: AssetTransformOptions) => {
  let emojiIcons: IconifyJSON | null = null

  return {
    name: 'nuxt-og-image:asset-transform',
    enforce: 'pre',

    transformInclude(id) {
      if (!id.endsWith('.vue'))
        return false
      // Check if file is inside any of the resolved OG component directories
      // Note: don't exclude node_modules - built-in community templates live there when installed as a dependency
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
      // Use ultrahtml to parse and transform - avoids complex regex patterns
      if (template.includes('<Icon') || template.includes('<UIcon')) {
        // First pass: collect icon prefixes from AST
        const prefixes = new Set<string>()
        const iconElements: Array<{ node: ElementNode, parent: Node, index: number }> = []

        // Wrap in div for parsing (ultrahtml needs a root)
        const wrappedTemplate = `<div>${template}</div>`
        const doc = parseHtml(wrappedTemplate)

        walkSync(doc, (node, parent, index) => {
          if (node.type === ELEMENT_NODE) {
            const el = node as ElementNode
            if (el.name === 'Icon' || el.name === 'UIcon') {
              const iconName = el.attributes.name
              if (iconName && !iconName.includes('{')) {
                const [prefix] = iconName.split(':')
                if (prefix)
                  prefixes.add(prefix)
                iconElements.push({ node: el, parent: parent!, index: index! })
              }
            }
          }
        })

        // Load icon sets
        const iconSets = new Map<string, IconifyJSON>()
        for (const prefix of prefixes) {
          const icons = await loadIconSet(prefix)
          if (icons)
            iconSets.set(prefix, icons)
        }

        // Second pass: replace icon elements with SVG
        if (iconSets.size > 0 && iconElements.length > 0) {
          for (const { node: el, parent, index } of iconElements) {
            const iconName = el.attributes.name
            if (!iconName)
              continue

            const [prefix, name] = iconName.split(':')
            if (!prefix || !name)
              continue

            const icons = iconSets.get(prefix)
            if (!icons)
              continue

            const iconData = icons.icons?.[name]
            if (!iconData)
              continue

            hasChanges = true
            // Build SVG and parse it back to AST node
            const svgHtml = buildIconSvg(iconData, icons.width || 24, icons.height || 24, el.attributes)
            const svgDoc = parseHtml(svgHtml)
            // Replace the icon element with the SVG span
            if ('children' in parent && Array.isArray(parent.children)) {
              parent.children[index] = svgDoc.children[0]
            }
          }

          // Render back to HTML, removing the wrapper div
          const rendered = renderSync(doc)
          // Remove wrapper div
          template = rendered.replace(/^<div>/, '').replace(/<\/div>$/, '')
        }
      }

      // Transform CSS utility classes to inline styles
      if (options.cssProvider) {
        try {
          // Wrap current template back into full SFC for AST parsing
          const fullCode = code.slice(0, templateStart) + template + code.slice(templateEnd)

          const result = await transformVueTemplate(fullCode, {
            resolveStyles: async (classes) => {
              // Filter unsupported classes first
              const supported = classes.filter(cls => !isSatoriUnsupported(cls))
              const unsupported = classes.filter(cls => isSatoriUnsupported(cls))

              if (unsupported.length > 0) {
                const componentName = id.split('/').pop()
                logger.warn(`[nuxt-og-image] ${componentName}: Filtered unsupported Satori classes: ${unsupported.join(', ')}`)
              }

              const componentName = id.split('/').pop()?.replace(/\.\w+$/, '')
              return options.cssProvider!.resolveClassesToStyles(supported, componentName)
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
          logger.warn(`[nuxt-og-image] ${componentName}: CSS template transform failed, using original template`, (err as Error).message)
          // Continue without CSS transforms - Satori will try to handle classes via tw prop
        }
      }

      // Resolve var() in HTML attributes (e.g., SVG fill="var(--bg)")
      if (options.cssProvider?.getVars && template.includes('var(')) {
        const vars = await options.cssProvider.getVars()
        if (vars.size > 0) {
          // Match attribute="...var(--...)..." patterns, excluding style and class attributes
          template = template.replace(/\b(?!style|class)([a-zA-Z-]+)="([^"]*var\(--[^"]+)"/g, (match, attr, value) => {
            const resolved = resolveCssVars(value, vars)
            if (resolved !== value) {
              hasChanges = true
              return `${attr}="${resolved}"`
            }
            return match
          })
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

      // Inline <style> blocks into template elements at build time.
      // Both satori and takumi need inline styles — <style> blocks aren't applied at render time.
      {
        const { descriptor } = parseSfc(code)
        if (descriptor.styles.length > 0) {
          for (const styleBlock of descriptor.styles) {
            const rawCss = styleBlock.content
            // Strip scoped data-v attribute selectors so we can match by class name alone
            const scopeId = styleBlock.scoped
              ? (rawCss.match(/\[data-v-([a-f0-9]+)\]/)?.[0] ?? null)
              : null
            const cleanCss = scopeId ? rawCss.replaceAll(scopeId, '') : rawCss

            const simplified = await simplifyCss(cleanCss)
            const classMap = extractClassStyles(simplified, { skipPrefixes: [] })

            if (classMap.size > 0) {
              // Walk template elements and merge matching styles
              const wrappedTemplate = `<div>${template}</div>`
              const doc = parseHtml(wrappedTemplate)

              walkSync(doc, (node) => {
                if (node.type !== ELEMENT_NODE)
                  return
                const el = node as ElementNode
                const classAttr = el.attributes?.class
                if (!classAttr)
                  return

                const elClasses = classAttr.split(/\s+/).filter(Boolean)
                const matchedStyles: Record<string, string> = {}
                const consumedClasses = new Set<string>()

                for (const cls of elClasses) {
                  const styles = classMap.get(cls)
                  if (styles) {
                    Object.assign(matchedStyles, styles)
                    consumedClasses.add(cls)
                  }
                }

                if (Object.keys(matchedStyles).length === 0)
                  return

                // Merge into existing inline style (inline style takes precedence)
                const existingStyle = el.attributes?.style || ''
                const existingProps: Record<string, string> = {}
                for (const decl of existingStyle.split(';')) {
                  const [prop, ...valParts] = decl.split(':')
                  const value = valParts.join(':').trim()
                  if (prop?.trim() && value)
                    existingProps[prop.trim()] = value
                }

                const merged = { ...matchedStyles, ...existingProps }
                el.attributes.style = Object.entries(merged)
                  .map(([p, v]) => `${p}:${v}`)
                  .join(';')

                // Remove consumed classes
                const remaining = elClasses.filter(c => !consumedClasses.has(c))
                if (remaining.length > 0)
                  el.attributes.class = remaining.join(' ')
                else
                  delete el.attributes.class

                // viewBox must be preserved (not kebab-cased)
                if (el.attributes.viewbox) {
                  el.attributes.viewBox = el.attributes.viewbox
                  delete el.attributes.viewbox
                }
              })

              template = renderSync(doc).replace(/^<div>/, '').replace(/<\/div>$/, '')
              hasChanges = true
            }
          }

          // Remove all <style> blocks from the SFC — styles are now inlined
          for (const styleBlock of descriptor.styles) {
            const styleStart = code.indexOf(styleBlock.loc.source) - '<style'.length
            // Find the full <style...>...</style> tag
            const fullTagStart = code.lastIndexOf('<style', styleStart + '<style'.length)
            const fullTagEnd = code.indexOf('</style>', styleStart) + '</style>'.length
            if (fullTagStart >= 0 && fullTagEnd > fullTagStart) {
              s.remove(fullTagStart, fullTagEnd)
            }
          }
        }
      }

      // Extract font requirements from the original code (before transforms)
      if (options.onFontRequirements) {
        extractFontRequirementsFromVue(code).then((reqs) => {
          options.onFontRequirements!(id, reqs)
        })
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
