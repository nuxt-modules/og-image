import type { NuxtIslandResponse } from 'nuxt/dist/core/runtime/nitro/renderer'
import type { OgImageRenderEventContext } from '../../../../types'
import { useCssInline } from '../instances'
import { useNitroOrigin } from '#imports'

export async function applyInlineCss({ e }: OgImageRenderEventContext, island: NuxtIslandResponse) {
  let html = island.html
  // inline styles from the island
  // empty.mjs returns an __unenv__ object as true
  let css = island.head.style.map(s => s.innerHTML).join('\n')
  // TODO this has an island bug in that it's rendering styles for components that aren't used because they're used in app.vue
  // TODO need to make an upstream issue
  const componentInlineStyles = island.head.link.filter(l => l.href.startsWith('/_nuxt/components'))
  if (import.meta.dev) {
    const linksToCss = componentInlineStyles.length
      ? (await Promise.all(
          componentInlineStyles
            .map((l) => {
            // for some reason we can't provide hmr=false when the lang isn't css (scss)
              const url = l.href.endsWith('lang.css') ? `${l.href}&hmr=false` : l.href
              return e.$fetch<string>(url, {
                responseType: 'text',
                baseURL: useNitroOrigin(e),
              }).then((res) => {
              // need to handle hmr response (scss)
                if (res.includes('__vite__css'))
                  return res.match(/__vite__css = "([^"]+)"/)?.[1]
                return res.trim().split('\n').filter(l => !l.startsWith('//')).join('\n').trim()
              })
                .catch(() => {
                  return '' // fails in dev with https if not secure
                })
            }),
        )).join('\n')
      : ''
    css = `${linksToCss}${css}`
  }
  // avoid loading css-inline wasm if we don't need
  if (!css.trim().length)
    return false
  const cssInline = await useCssInline()
  html = cssInline.inline(island.html, {
    loadRemoteStylesheets: false,
    extraCss: css,
  })
  // extract classses from the css
  const classes = css.match(/\.([\w-]+)/g)?.map(c => c.replace('.', ''))
  // remove classes from the html to avoid satori errors
  if (classes)
    html = html.replace(new RegExp(`class="(${classes.join('|')})"`, 'g'), '')

  island.html = html
  return true
}
