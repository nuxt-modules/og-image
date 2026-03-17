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
import { getEmojiCodePoint, getEmojiIconNames, RE_MATCH_EMOJIS } from '../runtime/server/og-image/core/transforms/emojis/emoji-utils'
import { resolveColorMix, splitCssDeclarations } from '../runtime/server/og-image/utils/css'
import { RE_WHITESPACE } from '../util'
import { extractFontRequirementsFromVue } from './css/css-classes'
import { downlevelColor, extractClassStyles, resolveCssVars, simplifyCss } from './css/css-utils'
import { transformVueTemplate } from './vue-template-transform'

let svgCounter = 0

// Module-scope regex constants
const RE_SVG_ID_ATTR = /\bid="([^"]+)"/g
const RE_SVG_VIEWBOX = /viewBox="([^"]*)"/
const RE_SVG_BODY = /<svg[^>]*>([\s\S]*)<\/svg>/
const RE_OG_IMAGE_QUERY = /\?og-image(?:-depth=\d+)?$/
const RE_TEMPLATE_CONTENT = /<template>([\s\S]*?)<\/template>/
const RE_TEXT_BETWEEN_TAGS = />([^<]*)</g
const RE_SPECIAL_REGEX_CHARS = /[.*+?^${}()|[\]\\]/g
const RE_WRAPPER_DIV_START = /^<div>/
const RE_WRAPPER_DIV_END = /<\/div>$/
const RE_ICON_ELEMENT = /<(\w+)((?:\s+[^\s/>][^\s=>]*(?:="[^"]*")?)*\s+class="([^"]*)"(?:\s+[^\s/>][^\s=>]*(?:="[^"]*")?)*)\s*\/?>(?:\s*<\/\1>)?/g
const RE_HTML_ATTR = /\b([a-z_:@][\w.:-]*)(?:="([^"]*)")?/gi
const RE_ROOT_ELEMENT = /^\s*<(\w+)\s([^>]*)>/
const RE_DATA_ATTR = /\bdata-([\w-]+)="([^"]*)"/g
const RE_COLOR_ATTR_NAME = /^(?:color|fill|stroke|flood-color|lighting-color|stop-color)$/
const RE_NON_STYLE_VAR_ATTR = /\b(?!style|class)([a-zA-Z-]+)="([^"]*var\(--[^"]+)"/g
const RE_QUOTED_ATTR = /^([a-z-]+)="(.*)"$/i
const RE_COLOR_PROP_NAME = /color|fill|stroke|background|border|outline|shadow|accent|caret/
const RE_STYLE_VAR_ATTR = /\bstyle="([^"]*var\(--[^"]+)"/g
const RE_INLINE_STYLE = /\bstyle="([^"]*)"/g
const RE_CSS_VAR_DEF = /--([\w-]+)\s*:\s*([^;]+)/g
const RE_DYNAMIC_STYLE_VAR = /:style="([^"]*var\(--[^"]+)"/g
const RE_IMAGE_SRC = /(?<!:)src="((?:\/|~\/|@\/)[^"]+\.(png|jpg|jpeg|gif|webp|svg))"/g
const RE_SCOPED_DATA_V = /\[data-v-([a-f0-9]+)\]/
const RE_FILE_EXTENSION = /\.\w+$/

// SVG utilities (shared across icons and emojis)
function makeIdsUnique(svg: string): string {
  const prefix = `og${svgCounter++}_`
  const ids = new Set<string>()
  RE_SVG_ID_ATTR.lastIndex = 0
  svg.replace(RE_SVG_ID_ATTR, (_, id) => {
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
  const attrsStr = filteredAttrs.length > 0 ? ` ${filteredAttrs.join(' ')}` : ''

  // Keep width/height="100%" — resolved to parent pixel dims by satori svg-size plugin at runtime
  const mergedStyle = existingStyle ? `display:flex; ${existingStyle}` : 'display:flex'
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
  if (iconCache.size > 20)
    iconCache.delete(iconCache.keys().next().value!)
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
        const viewBoxMatch = svg.match(RE_SVG_VIEWBOX)
        const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 128 128'
        const bodyMatch = svg.match(RE_SVG_BODY)
        const body = bodyMatch ? bodyMatch[1] : ''
        let result = `<span style="display:flex"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="1em" height="1em">${body}</svg></span>`
        result = makeIdsUnique(result)
        emojiFetchCache.set(cacheKey, result)
        if (emojiFetchCache.size > 200)
          emojiFetchCache.delete(emojiFetchCache.keys().next().value!)
        return result
      }
    }
    catch {
      // Continue to next name
    }
  }

  emojiFetchCache.set(cacheKey, null)
  if (emojiFetchCache.size > 200)
    emojiFetchCache.delete(emojiFetchCache.keys().next().value!)
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

// Unsupported utility patterns for OG image renderers - filtered at build time
const UNSUPPORTED_CLASS_PATTERNS = [
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

// UnoCSS icon class pattern: i-{collection}-{name} or i-{collection}:{name}
// Supports both hyphen and colon separators (e.g. i-lucide-star, i-lucide:star, i-simple-icons:github)
const ICON_CLASS_RE = /^i-([a-z\d]+(?:-[a-z\d]+)*)[-:](.+)$/

function isIconClass(cls: string): boolean {
  return ICON_CLASS_RE.test(cls)
}

function isUnsupportedClass(cls: string): boolean {
  return UNSUPPORTED_CLASS_PATTERNS.some(p => p.test(cls))
}

export interface AssetTransformOptions {
  /** Resolved absolute paths to OG component directories */
  ogComponentPaths: string[]
  rootDir: string
  srcDir: string
  publicDir: string
  /** Nuxt build directory (for resolving #build/ aliases) */
  buildDir?: string
  emojiSet?: string
  /** Pre-loaded emoji icon set (skips dynamic import) */
  emojiIcons?: IconifyJSON | null
  /**
   * CSS provider for resolving utility classes (TW4, UnoCSS, etc.)
   */
  cssProvider?: CssProvider
  /**
   * Fallback color preference from @nuxtjs/color-mode (used when template has no data-theme).
   */
  colorPreference?: 'light' | 'dark'
  /**
   * Callback invoked after extracting font requirements from each component.
   */
  onFontRequirements?: (id: string, reqs: Awaited<ReturnType<typeof extractFontRequirementsFromVue>>) => void
  /**
   * Called before CSS operations to flush any dirty HMR state.
   */
  beforeCssResolve?: () => void
  /**
   * Called when a file is transformed via ?og-image query param (nested component).
   * Used to track which files need HMR-triggered Nitro reloads.
   */
  onNestedTransform?: (filePath: string) => void
}

export const AssetTransformPlugin = createUnplugin((options: AssetTransformOptions) => {
  let emojiIcons: IconifyJSON | null = null

  return {
    name: 'nuxt-og-image:asset-transform',
    enforce: 'pre',

    transformInclude(id) {
      // Accept ?og-image query param (nested components rewritten by ComponentImportRewritePlugin)
      if (id.includes('?og-image'))
        return true
      if (!id.endsWith('.vue'))
        return false
      // Check if file is inside any of the resolved OG component directories
      // Note: don't exclude node_modules - built-in community templates live there when installed as a dependency
      return options.ogComponentPaths.some(dir => id.startsWith(`${dir}/`) || id.startsWith(`${dir}\\`))
    },

    async transform(code, rawId) {
      // Strip ?og-image query param for path operations (nested component imports)
      const id = rawId.replace(RE_OG_IMAGE_QUERY, '')

      // Track nested component files for HMR
      if (rawId.includes('?og-image'))
        options.onNestedTransform?.(id)

      const templateMatch = code.match(RE_TEMPLATE_CONTENT)
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
        await Promise.all(Array.from(allEmojis, async (emoji) => {
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
          RE_TEXT_BETWEEN_TAGS.lastIndex = 0
          template = template.replace(RE_TEXT_BETWEEN_TAGS, (fullMatch, textContent) => {
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
                const escaped = emoji.replace(RE_SPECIAL_REGEX_CHARS, '\\$&')
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
        if (iconElements.length > 0) {
          let anyReplaced = false
          for (const { node: el, parent, index } of iconElements) {
            const iconName = el.attributes.name
            if (!iconName)
              continue

            const [prefix, name] = iconName.split(':')
            if (!prefix || !name)
              continue

            // Try @iconify-json package first
            const icons = iconSets.get(prefix)
            const iconData = icons?.icons?.[name]

            let svgHtml: string | undefined
            if (iconData) {
              svgHtml = buildIconSvg(iconData, icons!.width || 24, icons!.height || 24, el.attributes)
            }
            // Fallback: resolve from CSS provider (e.g. UnoCSS presetIcons custom collections)
            else if (options.cssProvider?.resolveIcon) {
              const resolved = await options.cssProvider.resolveIcon(prefix, name)
              if (resolved)
                svgHtml = buildIconSvg(resolved, resolved.width, resolved.height, el.attributes)
            }

            if (!svgHtml)
              continue

            anyReplaced = true
            hasChanges = true
            const svgDoc = parseHtml(svgHtml)
            if ('children' in parent && Array.isArray(parent.children)) {
              parent.children[index] = svgDoc.children[0]
            }
          }

          if (anyReplaced) {
            // Render back to HTML, removing the wrapper div
            const rendered = renderSync(doc)
            // Remove wrapper div
            template = rendered.replace(RE_WRAPPER_DIV_START, '').replace(RE_WRAPPER_DIV_END, '')
          }
        }
      }

      // Transform UnoCSS icon classes (i-{collection}-{name}) to inline SVGs
      // Uses targeted string replacement (not ultrahtml renderSync) to preserve Vue directives like v-if
      if (options.cssProvider?.resolveIcon) {
        // Match elements with icon classes — self-closing or empty paired tags only
        const replacements: Array<{ from: string, to: string }> = []

        RE_ICON_ELEMENT.lastIndex = 0
        let elMatch
        // eslint-disable-next-line no-cond-assign
        while ((elMatch = RE_ICON_ELEMENT.exec(template)) !== null) {
          const [fullMatch, , attrsStr, classValue] = elMatch
          if (!classValue)
            continue

          // Check if class contains an icon pattern
          const classes = classValue.split(RE_WHITESPACE).filter(Boolean)
          let iconPrefix: string | undefined
          let iconName: string | undefined
          for (const cls of classes) {
            const im = cls.match(ICON_CLASS_RE)
            if (im?.[1] && im[2]) {
              iconPrefix = im[1]
              iconName = im[2]
              break
            }
          }
          if (!iconPrefix || !iconName)
            continue

          const resolved = await options.cssProvider.resolveIcon!(iconPrefix, iconName)
          if (!resolved)
            continue

          // Parse attributes from raw string, excluding class (rebuilt below), name,
          // and Vue dynamic bindings for style (:style/v-bind:style — the element is
          // replaced with a static SVG wrapper so dynamic bindings can't be evaluated)
          const attrs: Record<string, string> = {}
          RE_HTML_ATTR.lastIndex = 0
          let am
          // eslint-disable-next-line no-cond-assign
          while ((am = RE_HTML_ATTR.exec(attrsStr!)) !== null) {
            if (am[1] && am[1] !== 'class' && am[1] !== ':style' && am[1] !== 'v-bind:style')
              attrs[am[1]] = am[2] ?? ''
          }

          // Keep non-icon classes
          const otherClasses = classes.filter(c => !isIconClass(c))
          if (otherClasses.length > 0)
            attrs.class = otherClasses.join(' ')

          const svgHtml = buildIconSvg(resolved, resolved.width, resolved.height, attrs)
          replacements.push({ from: fullMatch, to: svgHtml })
        }

        for (const { from, to } of replacements) {
          template = template.replace(from, to)
          hasChanges = true
        }
      }

      // Extract data-* attrs from the template root element for CSS var resolution
      const rootAttrs: Record<string, string> = {}
      const rootAttrMatch = template.match(RE_ROOT_ELEMENT)
      if (rootAttrMatch?.[2]) {
        RE_DATA_ATTR.lastIndex = 0
        for (const m of rootAttrMatch[2].matchAll(RE_DATA_ATTR)) {
          if (m[1] && m[2])
            rootAttrs[`data-${m[1]}`] = m[2]
        }
      }
      // Fallback: if no data-theme on root, use colorPreference from module config
      if (!rootAttrs['data-theme'] && options.colorPreference)
        rootAttrs['data-theme'] = options.colorPreference

      // Transform CSS utility classes to inline styles
      if (options.cssProvider) {
        options.beforeCssResolve?.()
        try {
          // Wrap current template back into full SFC for AST parsing
          const fullCode = code.slice(0, templateStart) + template + code.slice(templateEnd)

          const result = await transformVueTemplate(fullCode, {
            resolveStyles: async (classes) => {
              // Filter unsupported classes and icon classes (handled via SVG replacement)
              const supported = classes.filter(cls => !isUnsupportedClass(cls) && !isIconClass(cls))
              const unsupported = classes.filter(cls => isUnsupportedClass(cls))

              if (unsupported.length > 0) {
                const componentName = id.split('/').pop()
                logger.warn(`[nuxt-og-image] ${componentName}: Filtered unsupported classes: ${unsupported.join(', ')}`)
              }

              const componentName = id.split('/').pop()?.replace(RE_FILE_EXTENSION, '')
              return options.cssProvider!.resolveClassesToStyles(supported, componentName, rootAttrs)
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

      // Resolve var() in HTML attributes and inline styles
      if (template.includes('var(')) {
        const vars = options.cssProvider?.getVars
          ? await options.cssProvider.getVars(rootAttrs)
          : new Map<string, string>()

        // Extract inline CSS custom property definitions from static style attributes
        RE_INLINE_STYLE.lastIndex = 0
        for (const m of template.matchAll(RE_INLINE_STYLE)) {
          RE_CSS_VAR_DEF.lastIndex = 0
          for (const def of m[1]!.matchAll(RE_CSS_VAR_DEF)) {
            const name = `--${def[1]}`
            if (!vars.has(name))
              vars.set(name, def[2]!.trim())
          }
        }

        if (vars.size > 0) {
          // Non-style, non-class attributes (e.g., SVG fill="var(--bg)")
          const replacements: Array<{ from: string, to: string }> = []
          RE_NON_STYLE_VAR_ATTR.lastIndex = 0
          template.replace(RE_NON_STYLE_VAR_ATTR, (match, attr, value) => {
            const resolved = resolveCssVars(value, vars)
            if (resolved !== value) {
              replacements.push({ from: match, to: `${attr}="${resolved}"` })
            }
            return match
          })
          // Downlevel modern colors (oklch, etc.) in color-related attributes
          for (const r of replacements) {
            const attrMatch = r.to.match(RE_QUOTED_ATTR)
            if (attrMatch?.[1] && attrMatch[2] !== undefined && RE_COLOR_ATTR_NAME.test(attrMatch[1])) {
              const downleveled = await downlevelColor(attrMatch[1], attrMatch[2])
              r.to = `${attrMatch[1]}="${downleveled}"`
            }
            template = template.replace(r.from, r.to)
            hasChanges = true
          }

          // Inline style attributes: resolve var() and downlevel colors per-declaration
          const styleReplacements: Array<{ from: string, to: string }> = []
          RE_STYLE_VAR_ATTR.lastIndex = 0
          template.replace(RE_STYLE_VAR_ATTR, (match, styleValue) => {
            const resolved = resolveCssVars(styleValue, vars)
            if (resolved !== styleValue)
              styleReplacements.push({ from: match, to: `style="${resolved}"` })
            return match
          })
          for (const r of styleReplacements) {
            // Downlevel modern colors in each declaration
            const styleContent = r.to.slice('style="'.length, -1)
            const declarations = styleContent.split(';').filter(Boolean)
            const downleveled: string[] = []
            for (const decl of declarations) {
              const colonIdx = decl.indexOf(':')
              if (colonIdx === -1) {
                downleveled.push(decl)
                continue
              }
              const prop = decl.slice(0, colonIdx).trim()
              let value = decl.slice(colonIdx + 1).trim()
              if (RE_COLOR_PROP_NAME.test(prop) && !value.includes('var(')) {
                value = await downlevelColor(prop, value)
                if (value.includes('color-mix('))
                  value = resolveColorMix(value)
              }
              downleveled.push(`${prop}: ${value}`)
            }
            r.to = `style="${downleveled.join('; ')}"`
            template = template.replace(r.from, r.to)
            hasChanges = true
          }

          // Dynamic :style bindings: resolve var() in Vue :style="..." attributes
          RE_DYNAMIC_STYLE_VAR.lastIndex = 0
          const dynamicReplacements: Array<{ from: string, to: string }> = []
          template.replace(RE_DYNAMIC_STYLE_VAR, (match, styleExpr) => {
            const resolved = resolveCssVars(styleExpr, vars)
            if (resolved !== styleExpr)
              dynamicReplacements.push({ from: match, to: `:style="${resolved}"` })
            return match
          })
          for (const r of dynamicReplacements) {
            template = template.replace(r.from, r.to)
            hasChanges = true
          }
        }
      }

      // Transform images: src="/path" or src="~/path" or src="@/path"
      if (!template.includes('data-no-inline')) {
        RE_IMAGE_SRC.lastIndex = 0
        if (RE_IMAGE_SRC.test(template)) {
          RE_IMAGE_SRC.lastIndex = 0

          const componentDir = dirname(id)
          const replacements: Array<{ from: string, to: string }> = []

          let match
          // eslint-disable-next-line no-cond-assign
          while ((match = RE_IMAGE_SRC.exec(template)) !== null) {
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
              ? (rawCss.match(RE_SCOPED_DATA_V)?.[0] ?? null)
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

                const elClasses = classAttr.split(RE_WHITESPACE).filter(Boolean)
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
                for (const decl of splitCssDeclarations(existingStyle)) {
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

              template = renderSync(doc).replace(RE_WRAPPER_DIV_START, '').replace(RE_WRAPPER_DIV_END, '')
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
