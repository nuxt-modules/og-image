import { withBase } from 'ufo'
import { renderSSRHead } from '@unhead/ssr'
import { createHeadCore } from '@unhead/vue'
import { defineEventHandler, getQuery, sendRedirect } from 'h3'
import { fetchOptions, renderIsland, useHostname } from '../utils'
import type { OgImageOptions } from '../../../types'
import { defaults, fonts } from '#nuxt-og-image/config'

export default defineEventHandler(async (e) => {
  const path = getQuery(e).path as string || '/'
  const scale = getQuery(e).scale
  const mode = getQuery(e).mode || 'light'
  // extract the options from the original path
  let options: OgImageOptions | undefined
  if (getQuery(e).options)
    options = JSON.parse(getQuery(e).options as string) as OgImageOptions

  if (!options)
    options = await fetchOptions(e, path)

  // for screenshots just return the base path
  if (options.provider === 'browser')
    return sendRedirect(e, withBase(path, useHostname(e)))

  // using Nuxt Island, generate the og:image HTML
  const island = await renderIsland(options)

  const head = createHeadCore()
  head.push(island.head)
  head.push({
    style: [
      {
        // default font is the first font family
        innerHTML: `body { font-family: \'${fonts[0].split(':')[0].replace('+', ' ')}\', sans-serif;  }`,
      },
      scale
        ? {
            innerHTML: `body {
    transform: scale(${scale});
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
}
`,
          }
        : {},
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
      ...fonts.map((font) => {
        const [name, weight] = font.split(':')
        return {
          href: `https://fonts.googleapis.com/css2?family=${name}:wght@${weight}&display=swap`,
          rel: 'stylesheet',
        }
      }),
    ],
  })
  const headChunk = await renderSSRHead(head)
  return `<!DOCTYPE html>
<html ${headChunk.htmlAttrs}>
<head>${headChunk.headTags}</head>
<body ${headChunk.bodyAttrs}>${headChunk.bodyTagsOpen}<div style="position: relative; display: flex; margin: 0 auto; width: 1200px; height: 630px;">${island.html}</div>${headChunk.bodyTags}</body>
</html>`
})
