import type { Component } from '@nuxt/schema'
import type { ElementNode } from '@vue/compiler-core'
import { parse as parseSfc } from '@vue/compiler-sfc'
import MagicString from 'magic-string'
import { createUnplugin } from 'unplugin'
import { walkTemplateAst } from './css/css-utils'

// Standard HTML elements — anything not in this set is a potential component
const HTML_ELEMENTS = new Set([
  'a',
  'abbr',
  'address',
  'area',
  'article',
  'aside',
  'audio',
  'b',
  'base',
  'bdi',
  'bdo',
  'blockquote',
  'body',
  'br',
  'button',
  'canvas',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'data',
  'datalist',
  'dd',
  'del',
  'details',
  'dfn',
  'dialog',
  'div',
  'dl',
  'dt',
  'em',
  'embed',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hgroup',
  'hr',
  'html',
  'i',
  'iframe',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'link',
  'main',
  'map',
  'mark',
  'menu',
  'meta',
  'meter',
  'nav',
  'noscript',
  'object',
  'ol',
  'optgroup',
  'option',
  'output',
  'p',
  'picture',
  'pre',
  'progress',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'script',
  'search',
  'section',
  'select',
  'slot',
  'small',
  'source',
  'span',
  'strong',
  'style',
  'sub',
  'summary',
  'sup',
  'svg',
  'table',
  'tbody',
  'td',
  'template',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'title',
  'tr',
  'track',
  'u',
  'ul',
  'var',
  'video',
  'wbr',
  // SVG elements
  'circle',
  'clipPath',
  'defs',
  'desc',
  'ellipse',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feConvMatrix',
  'feDiffuseLighting',
  'feDisplacementMap',
  'feDistantLight',
  'feFlood',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feGaussianBlur',
  'feImage',
  'feMerge',
  'feMergeNode',
  'feMorphology',
  'feOffset',
  'fePointLight',
  'feSpecularLighting',
  'feSpotLight',
  'feTile',
  'feTurbulence',
  'filter',
  'foreignObject',
  'g',
  'image',
  'line',
  'linearGradient',
  'marker',
  'mask',
  'path',
  'pattern',
  'polygon',
  'polyline',
  'radialGradient',
  'rect',
  'stop',
  'switch',
  'symbol',
  'text',
  'textPath',
  'tspan',
  'use',
  'view',
])

// Vue/Nuxt built-in components that should never be rewritten
const BUILTIN_COMPONENTS = new Set([
  'Component',
  'Transition',
  'TransitionGroup',
  'KeepAlive',
  'Teleport',
  'Suspense',
  'ClientOnly',
  'ServerOnly',
  'DevOnly',
  'NuxtPage',
  'NuxtLayout',
  'NuxtLink',
  'NuxtLoadingIndicator',
  'NuxtIsland',
])

export interface ComponentImportRewriteOptions {
  ogComponentPaths: string[]
  /** Getter for the full Nuxt component registry */
  getComponents: () => Component[]
}

/**
 * Injects explicit imports with ?og-image for nested components used in OG templates.
 * Runs with enforce: 'pre' so the explicit import overrides Nuxt's auto-import.
 * The ?og-image query param causes AssetTransformPlugin to also process these files.
 */
export const ComponentImportRewritePlugin = createUnplugin((options: ComponentImportRewriteOptions) => {
  return {
    name: 'nuxt-og-image:component-import-rewrite',
    enforce: 'pre',

    transformInclude(id) {
      // Only rewrite imports in OG template files themselves — NOT in ?og-image
      // nested components. This prevents unbounded cascading through the entire
      // component tree. Nested components still get AssetTransformPlugin via
      // ?og-image, but they don't propagate further.
      if (id.includes('?og-image'))
        return false
      if (!id.endsWith('.vue'))
        return false
      return options.ogComponentPaths.some(dir => id.startsWith(`${dir}/`) || id.startsWith(`${dir}\\`))
    },

    transform(code, _id) {
      const { descriptor } = parseSfc(code)
      if (!descriptor.template?.ast) {
        return
      }

      // Collect component tag names used in the template
      const usedComponents = new Set<string>()
      walkTemplateAst(descriptor.template.ast.children, (node) => {
        // type 1 = NodeTypes.ELEMENT
        if (node.type === 1 && !HTML_ELEMENTS.has((node as ElementNode).tag) && !BUILTIN_COMPONENTS.has((node as ElementNode).tag)) {
          usedComponents.add((node as ElementNode).tag)
        }
      })

      if (usedComponents.size === 0) {
        return
      }

      // Resolve component tags against the Nuxt component registry
      const components = options.getComponents()
      const newImports: Array<{ name: string, filePath: string }> = []

      for (const tag of usedComponents) {
        // Already handled by asset transform (Icon/UIcon → inline SVG)
        if (tag === 'Icon' || tag === 'UIcon')
          continue

        const match = components.find(c => c.pascalName === tag || c.kebabName === tag)
        if (match?.filePath && match.filePath.endsWith('.vue')) {
          newImports.push({ name: tag, filePath: match.filePath })
        }
      }

      if (newImports.length === 0) {
        return
      }

      const s = new MagicString(code)

      // Rewrite existing .vue imports to add ?og-image, collect which ones we handled
      const rewritten = new Set<string>()
      const scriptBlock = descriptor.scriptSetup || descriptor.script
      if (scriptBlock) {
        const scriptStart = scriptBlock.loc.start.offset
        const scriptContent = scriptBlock.content
        // Match: import Foo from './path.vue' or "path.vue"
        for (const m of scriptContent.matchAll(/import\s+(\w+)\s+from\s+(['"])(.+?\.vue)\2/g)) {
          const importName = m[1]
          if (newImports.some(i => i.name === importName)) {
            const source = m[3]!
            // Replace the source path with ?og-image appended
            const matchStart = scriptStart + m.index! + m[0].indexOf(source)
            s.overwrite(matchStart, matchStart + source.length, `${source}?og-image`)
            rewritten.add(importName!)
          }
        }
      }

      // Filter to only imports not already rewritten
      const imports = newImports.filter(i => !rewritten.has(i.name))

      if (imports.length === 0) {
        return {
          code: s.toString(),
          map: s.generateMap({ hires: true }),
        }
      }

      // Build import statements for new imports
      const importStatements = imports
        .map(i => `import ${i.name} from '${i.filePath}?og-image'`)
        .join('\n')

      // Inject into existing <script setup> or create one
      if (descriptor.scriptSetup) {
        // Insert after the opening <script setup> tag
        const scriptSetupStart = code.indexOf('<script setup')
        const tagEnd = code.indexOf('>', scriptSetupStart) + 1
        s.appendRight(tagEnd, `\n${importStatements}`)
      }
      else if (descriptor.script) {
        // Insert after the opening <script> tag
        const scriptStart = code.indexOf('<script')
        const tagEnd = code.indexOf('>', scriptStart) + 1
        s.appendRight(tagEnd, `\n${importStatements}`)
      }
      else {
        // No script block — add one
        s.prepend(`<script setup>\n${importStatements}\n</script>\n`)
      }

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      }
    },
  }
})
