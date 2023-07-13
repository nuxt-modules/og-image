import { withBase } from 'ufo'
import { renderSSRHead } from '@unhead/ssr'
import { createHeadCore } from '@unhead/vue'
import { createError, defineEventHandler, getQuery, sendRedirect } from 'h3'
import { hash } from 'ohash'
import type { NuxtIslandResponse } from 'nuxt/dist/core/runtime/nitro/renderer'
import twemoji from 'twemoji'
import { defu } from 'defu'
import { fetchOptionsCached } from '../utils'
import type { FontConfig, OgImageOptions } from '../../types'
import { useNitroOrigin, useRuntimeConfig } from '#imports'
import loadInlineCSS from '#nuxt-og-image/inline-css'

export default defineEventHandler(async (e) => {
  const { fonts, satoriOptions } = useRuntimeConfig()['nuxt-og-image']
  const query = getQuery(e)
  const path = withBase(query.path as string || '/', useRuntimeConfig().app.baseURL)
  const scale = query.scale
  const mode = query.mode || 'light'
  const nitroOrigin = useNitroOrigin(e)
  // extract the options from the original path
  let queryOptions: OgImageOptions | undefined
  if (query.options) {
    try {
      queryOptions = JSON.parse(query.options as string) as OgImageOptions
    }
    catch {
      // fallback is okay
    }
  }

  let options = await fetchOptionsCached(e, path)
  if (queryOptions)
    options = defu(queryOptions, options)

  // for screenshots just return the base path
  if (options.provider === 'browser' && options.component === 'PageScreenshot') {
    // need the path without the base url, left trim the base url
    const pathWithoutBase = path.replace(new RegExp(`^${useRuntimeConfig().app.baseURL}`), '')
    return sendRedirect(e, withBase(pathWithoutBase, nitroOrigin))
  }

  if (!options.component) {
    throw createError({
      statusCode: 500,
      statusMessage: `Nuxt OG Image trying to render an invalid component. Received options ${JSON.stringify(options)}`,
    })
  }

  // using Nuxt Island, generate the og:image HTML
  const hashId = hash([options.component, options])
  const island = await $fetch<NuxtIslandResponse>(`/__nuxt_island/${options.component}_${hashId}`, {
    params: {
      props: JSON.stringify(options),
    },
  })

  const head = createHeadCore()
  head.push(island.head)

  let defaultFontFamily = 'sans-serif'
  const firstFont = fonts[0] as FontConfig
  if (firstFont)
    defaultFontFamily = firstFont.name

  let html = island.html
  try {
    html = twemoji.parse(html!, {
      folder: 'svg',
      ext: '.svg',
    })
  }
  catch (e) {}

  head.push({
    style: [
      {
        // default font is the first font family
        innerHTML: `body { font-family: \'${defaultFontFamily.replace('+', ' ')}\', sans-serif;  }`,
      },
      {
        innerHTML: `body {
    transform: scale(${scale || 1});
    transform-origin: top left;
    max-height: 100vh;
    position: relative;
    width: ${options.width}px;
    height: ${options.height}px;
    overflow: hidden;
    background-color: ${mode === 'dark' ? '#1b1b1b' : '#fff'};
}
img.emoji {
   height: 1em;
   width: 1em;
   margin: 0 .05em 0 .1em;
   vertical-align: -0.1em;
}`,
      },
      ...(fonts as FontConfig[])
        .filter(font => font.path)
        .map((font) => {
          return `
          @font-face {
            font-family: '${font.name}';
            font-style: normal;
            font-weight: ${font.weight};
            src: url('${font.path}') format('truetype');
          }
          `
        }),
    ],
    meta: [
      {
        charset: 'utf-8',
      },
    ],
    script: [
      {
        src: 'https://cdn.tailwindcss.com',
      },
      {
        innerHTML: `tailwind.config = {
  corePlugins: {
    preflight: false,
  },
  theme: ${JSON.stringify(satoriOptions?.tailwindConfig?.theme || {})}
}`,
      },
    ],
    link: [
      {
        // reset css to match svg output
        href: 'https://cdn.jsdelivr.net/npm/gardevoir',
        rel: 'stylesheet',
      },
      // have to add each weight as their own stylesheet
      ...(fonts as FontConfig[])
        .filter(font => !font.path)
        .map((font) => {
          return {
            href: `https://fonts.googleapis.com/css2?family=${font.name}:wght@${font.weight}&display=swap`,
            rel: 'stylesheet',
          }
        }),
    ],
  })
  const headChunk = await renderSSRHead(head)
  let htmlTemplate = `<!DOCTYPE html>
<html ${headChunk.htmlAttrs}>
<head>${headChunk.headTags}</head>
<body ${headChunk.bodyAttrs}>${headChunk.bodyTagsOpen}<div style="position: relative; display: flex; margin: 0 auto; width: ${options.width}px; height: ${options.height}px; overflow: hidden;">${html}</div>${headChunk.bodyTags}</body>
</html>`

  // need to remove ALL script tags from the html
  htmlTemplate = htmlTemplate.replaceAll(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  const inlineCss = loadInlineCSS()
  if (!inlineCss.__mock) {
    let hasInlineStyles = false
    // for the tags we extract the stylesheet href and inline them where they are a vue template
    const stylesheets = htmlTemplate.match(/<link rel="stylesheet" href=".*?">/g)
    if (stylesheets) {
      for (const stylesheet of stylesheets) {
        // @todo we should check the actual component names
        if (!stylesheet.includes(`${options.component.replace('OgImageTemplate', '').replace('OgImage', '')}.vue`)) {
          htmlTemplate = htmlTemplate.replace(stylesheet, '')
        }
        else {
          // using regex
          const href = stylesheet.match(/href="(.*?)"/)![1]
          try {
            let css = (await (await $fetch(href, {
              baseURL: nitroOrigin,
            })).text())
            // css is in format of const __vite__css = "<css>"
            if (css.includes('const __vite__css =')) {
              // decode characters like \n
              css = css.match(/const __vite__css = "(.*)"/)![1].replace(/\\n/g, '\n')
            }
            css = css.replace(/\/\*# sourceMappingURL=.*?\*\//g, '')
              // need to replace all !important, they don't work in Satori
              .replaceAll('! important', '')
              .replaceAll('!important')
            // we remove the last line from the css //# sourceMappingURL=
            htmlTemplate = htmlTemplate.replace(stylesheet, `<style>${css}</style>`)
            hasInlineStyles = true
          }
          catch {
          }
        }
      }
    }
    if (hasInlineStyles) {
      try {
        htmlTemplate = await inlineCss(htmlTemplate, {
          url: nitroOrigin,
        })
      }
      catch {
      }
    }
  }
  return htmlTemplate
})
