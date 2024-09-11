import { pathToFileURL } from 'node:url'
import MagicString from 'magic-string'
import { stripLiteral } from 'strip-literal'
import { parseQuery, parseURL } from 'ufo'
import { createUnplugin } from 'unplugin'

export function isVue(id: string, opts: { type?: Array<'template' | 'script' | 'style'> } = {}) {
  // Bare `.vue` file (in Vite)
  const { search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
  if (id.endsWith('.vue') && !search) {
    return true
  }

  if (!search) {
    return false
  }

  const query = parseQuery(search)

  // Component async/lazy wrapper
  if (query.nuxt_component) {
    return false
  }

  // Macro
  if (query.macro && (search === '?macro=true' || !opts.type || opts.type.includes('script'))) {
    return true
  }

  // Non-Vue or Styles
  const type = 'setup' in query ? 'script' : query.type as 'script' | 'template' | 'style'
  if (!('vue' in query) || (opts.type && !opts.type.includes(type))) {
    return false
  }

  // Query `?vue&type=template` (in Webpack or external template)
  return true
}

const JS_RE = /\.(?:[cm]?j|t)sx?$/

export function isJS(id: string) {
  // JavaScript files
  const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href))
  return JS_RE.test(pathname)
}

export const TreeShakeComposablesPlugin = createUnplugin(() => {
  /**
   * @todo Use the options import-path to tree-shake composables in a safer way.
   */
  const composableNames = [
    'defineOgImage',
    'defineOgImageComponent',
    'defineOgImageScreenshot',
  ]

  const regexp = `(^\\s*)(${composableNames.join('|')})(?=\\((?!\\) \\{))`
  const COMPOSABLE_RE = new RegExp(regexp, 'm')
  const COMPOSABLE_RE_GLOBAL = new RegExp(regexp, 'gm')

  return {
    name: 'nuxt-og-image:zero-runtime:transform',
    enforce: 'pre',
    transformInclude(id) {
      return isVue(id, { type: ['script'] }) || isJS(id)
    },
    transform(code, id) {
      const s = new MagicString(code)
      if (id.endsWith('components.islands.mjs')) {
        // we need to strip all of the OgImage components from this using regex
        for (const match of code.matchAll(/"OgImage.*": defineAsyncComponent\(.*\),?/g)) {
          s.overwrite(match.index!, match.index! + match[0].length, '')
        }
      }
      else {
        const strippedCode = stripLiteral(code)
        if (!COMPOSABLE_RE.test(code)) {
          return
        }

        for (const match of strippedCode.matchAll(COMPOSABLE_RE_GLOBAL)) {
          s.overwrite(match.index!, match.index! + match[0].length, `${match[1]} import.meta.prerender && ${match[2]}`)
        }
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: s.generateMap({ hires: true }),
        }
      }
    },
  }
})
