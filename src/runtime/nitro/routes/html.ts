import { withBase } from 'ufo'
import { renderSSRHead } from '@unhead/ssr'
import { createHeadCore } from '@unhead/vue'
import { createError, defineEventHandler, getQuery, sendRedirect } from 'h3'
import { hash } from 'ohash'
import type { NuxtIslandResponse } from 'nuxt/dist/core/runtime/nitro/renderer'
import twemoji from 'twemoji'
import inlineCss from 'inline-css'
import { fetchOptions, useHostname } from '../utils'
import type { FontConfig, OgImageOptions } from '../../../types'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (e) => {
  const { fonts, defaults } = useRuntimeConfig()['nuxt-og-image']
  const query = getQuery(e)
  const path = withBase(query.path as string || '/', useRuntimeConfig().app.baseURL)
  const scale = query.scale
  const mode = query.mode || 'light'
  // extract the options from the original path
  let options: OgImageOptions | undefined
  if (query.options) {
    try {
      options = JSON.parse(query.options as string) as OgImageOptions
    }
    catch {
      // fallback is okay
    }
  }

  if (!options)
    options = await fetchOptions(e, path)

  // for screenshots just return the base path
  if (options.provider === 'browser' && !options.component) {
    // need the path without the base url, left trim the base url
    const pathWithoutBase = path.replace(new RegExp(`^${useRuntimeConfig().app.baseURL}`), '')
    return sendRedirect(e, withBase(pathWithoutBase, useHostname(e)))
  }

  if (!options.component) {
    throw createError({
      statusCode: 500,
      statusMessage: `Nuxt OG Image trying to render an invalid component. Received options ${JSON.stringify(options)}`,
    })
  }

  // using Nuxt Island, generate the og:image HTML
  const hashId = hash([options.component, options])
  const island = await $fetch<NuxtIslandResponse>(`/__nuxt_island/${options.component}:${hashId}`, {
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
    width: ${defaults.width}px;
    height: ${defaults.height}px;
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
      // @todo merge with users tailwind
      {
        innerHTML: `tailwind.config = {
  corePlugins: {
    preflight: false,
  }
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
<body ${headChunk.bodyAttrs}>${headChunk.bodyTagsOpen}<div style="position: relative; display: flex; margin: 0 auto; width: 1200px; height: 630px;">${html}</div>${headChunk.bodyTags}</body>
</html>`

  // for the tags we extract the stylesheet href and inline them where they are a vue template
  const stylesheets = htmlTemplate.match(/<link rel="stylesheet" href=".*">/g)
  if (stylesheets) {
    for (const stylesheet of stylesheets) {
      // avoid prefetch
      const href = stylesheet.match(/<link rel="stylesheet" href="(.*)">/)![1]
      try {
        // avoid including error page styles
        if (stylesheet.includes('@nuxt/ui-templates')) {
          htmlTemplate = htmlTemplate.replace(stylesheet, '')
        }
        else {
          const css = (await (await $fetch(href, {
            baseURL: useHostname(e),
          })).text()).replace(/\/\/# sourceMappingURL=.*/, '')
          // we remove the last line from the css //# sourceMappingURL=
          htmlTemplate = htmlTemplate.replace(stylesheet, `<style>${css}</style>`)
        }
      }
      catch {}
    }
  }
  try {
    htmlTemplate = inlineCss(htmlTemplate, {
      url: useHostname(e),
      applyLinkTags: false,
      removeLinkTags: false,
      removeStyleTags: false,
    })
  }
  catch {}
  return htmlTemplate
})
