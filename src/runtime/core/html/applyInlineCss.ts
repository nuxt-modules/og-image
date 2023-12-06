import type { NuxtIslandResponse } from 'nuxt/dist/core/runtime/nitro/renderer'
import { useCssInline } from '../renderers/satori/instances'
import type { OgImageRenderEventContext } from '../../types'
import { useNitroOrigin } from '#imports'
import cssInline from '#nuxt-og-image/bindings/css-inline'

export async function applyInlineCss({ e }: OgImageRenderEventContext, island: NuxtIslandResponse) {
  let html = island.html
  const componentInlineStyles = island.head.link.filter(l => l.href.startsWith('/_nuxt/components'))
  const usingInlineCss = !!componentInlineStyles.length
  // inline styles from the island
  // empty.mjs returns an __unenv__ object as true
  if (!cssInline.__unenv__ && componentInlineStyles.length) {
    const css = island.head.style.map(s => s.innerHTML).join('\n')
    const linksToCss = (await Promise.all(
      componentInlineStyles
        .map((l) => {
          return e.$fetch<string>(`${l.href}&hmr=false`, {
            responseType: 'text',
            baseURL: useNitroOrigin(e),
          }).then((res) => {
            return res.trim().split('\n').filter(l => !l.startsWith('//')).join('\n').trim()
          })
        }),
    )).join('\n')
    const cssToInline = `${linksToCss}${css}`
    const cssInline = await useCssInline()
    html = cssInline.inline(island.html, {
      load_remote_stylesheets: false,
      extra_css: cssToInline,
    })
    // extract classses from the css
    const classes = cssToInline.match(/\.([a-zA-Z0-9-_]+)/g)?.map(c => c.replace('.', ''))
    // remove classes from the html to avoid satori errors
    if (classes)
      html = html.replace(new RegExp(`class="(${classes.join('|')})"`, 'g'), '')

    island.html = html
  }
  return usingInlineCss
}
