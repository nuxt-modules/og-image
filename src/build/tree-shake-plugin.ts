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

// Ids carry a query in dev and for SFC blocks, so every extension match allows one.
const VUE_RE = /\.vue(?:\?|$)/
const JS_RE = /\.[cm]?[jt]sx?(?:\?|$)/
// Nuxt's island component registry re-exports every island component. Rewriting a call
// there would break the manifest, so the plugin has always skipped the file.
const ISLANDS_RE = /components\.islands\.mjs(?:\?|$)/
// Every composable this plugin rewrites starts with `defineOgImage`, so a module without
// that substring can never need the transform. unplugin hands the test to the bundler
// natively where supported, so the hook is not called at all for the rest of the graph.
const COMPOSABLE_CODE_MARKER = 'defineOgImage'

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
  // eslint-disable-next-line regexp/no-unused-capturing-group
  const COMPOSABLE_RE = new RegExp(regexp, 'm')

  const COMPOSABLE_RE_GLOBAL = new RegExp(regexp, 'gm')

  return {
    name: 'nuxt-og-image:zero-runtime:transform',
    enforce: 'pre',
    transform: {
      filter: {
        // @todo re-implement composable tree-shaking for island files
        id: { include: [VUE_RE, JS_RE], exclude: [ISLANDS_RE] },
        code: COMPOSABLE_CODE_MARKER,
      },
      handler(code, id) {
        // A `.vue` id reaches us once per SFC block. Only the script block is ours.
        if (VUE_RE.test(id) && !isVue(id, { type: ['script'] })) {
          return
        }
        // `stripLiteral` parses the whole module, so run the cheap test first.
        if (!COMPOSABLE_RE.test(code)) {
          return
        }

        const s = new MagicString(code)
        for (const match of stripLiteral(code).matchAll(COMPOSABLE_RE_GLOBAL)) {
          s.overwrite(match.index!, match.index! + match[0].length, `${match[1]} import.meta.prerender && ${match[2]}`)
        }

        if (!s.hasChanged()) {
          return
        }
        return {
          code: s.toString(),
          map: s.generateMap({ hires: true }),
        }
      },
    },
  }
})
