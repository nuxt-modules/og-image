import type { NuxtIslandResponse } from 'nuxt/dist/core/runtime/nitro/renderer'
import type { OgImageRenderEventContext } from '../../../../types'
import { useNitroOrigin } from '#imports'
import { createConsola } from 'consola'
import { useCssInline } from '../instances'

export async function applyInlineCss(ctx: OgImageRenderEventContext, island: NuxtIslandResponse) {
  const { e } = ctx
  let html = island.html
  // inline styles from the island
  // empty.mjs returns an __unenv__ object as true
  let css = island.head.style?.map(s => s.innerHTML).filter(Boolean).join('\n') || ''
  // TODO this has an island bug in that it's rendering styles for components that aren't used because they're used in app.vue
  // TODO need to make an upstream issue
  const componentInlineStyles = island.head.link?.filter(l => l.href.startsWith('/_nuxt/components') && l.href.replaceAll('/', '').includes(ctx.options.component)) || []
  // stricter opt-in for runtime
  if (!import.meta.prerender && !componentInlineStyles.length) {
    return false
  }
  let linksToCss = []
  if (import.meta.dev) {
    linksToCss = componentInlineStyles.length
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
              }).catch(() => {
                return '' // fails in dev with https if not secure
              })
            }),
        )).join('\n')
      : ''
    css = [linksToCss, css].join('\n')
  }
  // avoid loading css-inline wasm if we don't need
  if (!css.trim().length)
    return false
  const cssInline = await useCssInline()
  // dependency missing
  if (!cssInline || cssInline?.__mock__) {
    if (componentInlineStyles.length) {
      const logger = createConsola().withTag('Nuxt OG Image')
      logger.warn('To have inline styles applied you need to install either the `@css-inline/css-inline` or `@css-inline/css-inline-wasm` package.')
    }
    return false
  }
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
