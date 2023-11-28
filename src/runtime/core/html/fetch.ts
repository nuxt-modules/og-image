import { type H3Event, createError } from 'h3'
import { hash } from 'ohash'
import { createHeadCore } from '@unhead/vue'
import twemoji from 'twemoji'
import { renderSSRHead } from '@unhead/ssr'
import type { NuxtIslandResponse } from 'nuxt/dist/core/runtime/nitro/renderer'
import type { FontConfig, RendererOptions, RuntimeOgImageOptions } from '../../types'
import { useRuntimeConfig } from '#imports'

export async function fetchHTML(e: H3Event, options: RuntimeOgImageOptions | RendererOptions) {
  const { fonts, satoriOptions } = useRuntimeConfig()['nuxt-og-image']
  // const path = options.path
  // const scale = query.scale
  // const mode = query.mode || 'light'
  // extract the options from the original path

  // for screenshots just return the base path
  // if (options.provider === 'browser' && options.component === 'PageScreenshot') {
  //   // need the path without the base url, left trim the base url
  //   const pathWithoutBase = path.replace(new RegExp(`^${useRuntimeConfig().app.baseURL}`), '')
  //   return sendRedirect(e, withBase(pathWithoutBase, nitroOrigin))
  // }

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

  // we need to group fonts by name
  const googleFonts: Record<string, FontConfig[]> = {}
  ;(fonts as FontConfig[])
    .filter(font => !font.path)
    .forEach((font) => {
      if (!googleFonts[font.name])
        googleFonts[font.name] = []
      googleFonts[font.name].push(font)
    })

  head.push({
    style: [
      {
        // default font is the first font family
        innerHTML: `body { font-family: \'${defaultFontFamily.replace('+', ' ')}\', sans-serif;  }`,
      },
      {
        innerHTML: `body {
    transform: scale(${options.scale || 1});
    transform-origin: top left;
    max-height: 100vh;
    position: relative;
    width: ${options.width}px;
    height: ${options.height}px;
    overflow: hidden;
    background-color: ${options.mode === 'dark' ? '#1b1b1b' : '#fff'};
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
      ...Object.entries(googleFonts)
        .map(([name, fonts]) => {
          return {
            href: `https://fonts.googleapis.com/css2?family=${name}:wght@${fonts.map(f => f.weight).join(';')}&display=swap`,
            rel: 'stylesheet',
          }
        }),
    ],
  })

  // need to remove ALL script tags from the html
  html = html.replaceAll(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  const headChunk = await renderSSRHead(head)
  const htmlTemplate = `<!DOCTYPE html>
<html ${headChunk.htmlAttrs}>
<head>${headChunk.headTags}</head>
<body ${headChunk.bodyAttrs}>${headChunk.bodyTagsOpen}<div data-v-inspector-ignore="true" style="position: relative; display: flex; margin: 0 auto; width: ${options.width}px; height: ${options.height}px; overflow: hidden;">${html}</div>${headChunk.bodyTags}</body>
</html>`

  // TODO re-eneable
  // const cssInline = loadCSSInline()
  // if (!cssInline.__mock) {
  //   let hasInlineStyles = false
  //   // for the tags we extract the stylesheet href and inline them where they are a vue template
  //   const stylesheets = htmlTemplate.match(/<link rel="stylesheet" href=".*?">/g)
  //   if (stylesheets) {
  //     for (const stylesheet of stylesheets) {
  //       // @todo we should check the actual component names
  //       if (!stylesheet.includes(`${options.component.replace('OgImageTemplate', '').replace('OgImage', '')}.vue`)) {
  //         htmlTemplate = htmlTemplate.replace(stylesheet, '')
  //       }
  //       else {
  //         // using regex
  //         const href = stylesheet.match(/href="(.*?)"/)![1]
  //         try {
  //           let css = (await (await $fetch(href, {
  //             baseURL: nitroOrigin,
  //           })).text())
  //           // css is in format of const __vite__css = "<css>"
  //           if (css.includes('const __vite__css =')) {
  //             // decode characters like \n
  //             css = css.match(/const __vite__css = "(.*)"/)![1].replace(/\\n/g, '\n')
  //           }
  //           css = css.replace(/\/\*# sourceMappingURL=.*?\*\//g, '')
  //             // need to replace all !important, they don't work in Satori
  //             .replaceAll('! important', '')
  //             .replaceAll('!important')
  //           // we remove the last line from the css //# sourceMappingURL=
  //           htmlTemplate = htmlTemplate.replace(stylesheet, `<style>${css}</style>`)
  //           hasInlineStyles = true
  //         }
  //         catch {
  //         }
  //       }
  //     }
  //   }
  //   if (hasInlineStyles) {
  //     try {
  //       htmlTemplate = await cssInline(htmlTemplate, {
  //         url: nitroOrigin,
  //       })
  //     }
  //     catch {
  //     }
  //   }
  // }
  return htmlTemplate
}
