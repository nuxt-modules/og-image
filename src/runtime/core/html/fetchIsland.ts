import { type H3Event, createError } from 'h3'
import { hash } from 'ohash'
import type { NuxtIslandResponse } from 'nuxt/dist/core/runtime/nitro/renderer'
import type { RendererOptions, RuntimeOgImageOptions } from '../../types'
import cssInline from '#nuxt-og-image/bindings/css-inline'
import { useNitroOrigin } from '#imports'

export async function fetchIsland(e: H3Event, options: RuntimeOgImageOptions | RendererOptions): Promise<NuxtIslandResponse> {
  if (!options.component) {
    throw createError({
      statusCode: 500,
      statusMessage: `Nuxt OG Image trying to render an invalid component. Received options ${JSON.stringify(options)}`,
    })
  }

  // using Nuxt Island, generate the og:image HTML
  const hashId = hash([options.component, options, Math.random() * 100])
  const island = await e.$fetch<NuxtIslandResponse>(`/__nuxt_island/${options.component}_${hashId}.json`, {
    params: {
      props: JSON.stringify(options),
    },
  })

  let html = island.html
  const componentInlineStyles = island.head.link.filter(l => l.href.startsWith('/_nuxt/components'))
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
  return island
}
