import type { FontConfig, OgImageRenderEventContext } from '../../../types'
import { theme } from '#og-image-virtual/unocss-config.mjs'
import { createHeadCore } from '@unhead/vue'
import { renderSSRHead } from '@unhead/vue/server'
import { createError } from 'h3'
import { normaliseFontInput } from '../../../shared'
import { fetchIsland } from '../../util/kit'
import { useOgImageRuntimeConfig } from '../../utils'
import { applyEmojis } from '../satori/transforms/emojis'

export async function html(ctx: OgImageRenderEventContext) {
  const { options } = ctx
  const { fonts } = useOgImageRuntimeConfig()
  // const scale = query.scale
  // const mode = query.mode || 'light'
  // extract the options from the original path

  if (!options.component) {
    throw createError({
      statusCode: 500,
      statusMessage: `[Nuxt OG Image] Rendering an invalid component. Received options: ${JSON.stringify(options)}.`,
    })
  }
  const island = await fetchIsland(ctx.e, ctx.options.component!, typeof ctx.options.props !== 'undefined' ? ctx.options.props : ctx.options)
  const head = createHeadCore()
  head.push(island.head)

  let defaultFontFamily = 'sans-serif'
  const normalisedFonts = normaliseFontInput([...options.fonts || [], ...fonts])
  const firstFont = normalisedFonts[0] as FontConfig
  if (firstFont)
    defaultFontFamily = firstFont.name.replaceAll('+', ' ')

  await applyEmojis(ctx, island)
  let html = island.html

  head.push({
    style: [
      {
        // default font is the first font family
        innerHTML: `body { font-family: \'${defaultFontFamily}\', sans-serif;  }`,
      },
      {
        innerHTML: `body {
    transform: scale(${options.props?.scale || 1});
    transform-origin: top left;
    max-height: 100vh;
    position: relative;
    width: ${options.width}px;
    height: ${options.height}px;
    overflow: hidden;
    background-color: ${options.props?.colorMode === 'dark' ? '#1b1b1b' : '#fff'};
}
div {
  display: flex;
}
div:has(div, p, ul, ol, li, blockquote, pre, hr, table, dl) {
  display: flex;
  flex-direction: column;
}
div:not(:has(div, p, ul, ol, li, blockquote, pre, hr, table, dl)) {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

svg[data-emoji] {
  display: inline-block;
}
`,
      },
      ...(fonts as FontConfig[])
        // .filter(font => font.path)
        .map((font) => {
          return `
          @font-face {
            font-family: '${font.name.replaceAll('+', ' ')}';
            font-style: normal;
            font-weight: ${font.weight};
            src: url('/_og/f/${font.key}') format('truetype');
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
        src: 'https://cdn.jsdelivr.net/npm/@unocss/runtime/preset-wind.global.js',
      },
      {
        innerHTML: `
  window.__unocss = {
    theme: ${JSON.stringify(theme)},
    presets: [
      () => window.__unocss_runtime.presets.presetWind(),
    ],
  }
`,
      },
      {
        src: 'https://cdn.jsdelivr.net/npm/@unocss/runtime/core.global.js',
      },
    ],
    link: [
      {
        // reset css to match svg output
        href: 'https://cdn.jsdelivr.net/npm/gardevoir',
        rel: 'stylesheet',
      },
    ],
  })

  // need to remove ALL script tags from the html
  html = html.replaceAll(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  const headChunk = await renderSSRHead(head)
  return `<!DOCTYPE html>
<html ${headChunk.htmlAttrs}>
<head>${headChunk.headTags}</head>
<body ${headChunk.bodyAttrs}>${headChunk.bodyTagsOpen}<div data-v-inspector-ignore="true" style="position: relative; display: flex; margin: 0 auto; width: ${options.width}px; height: ${options.height}px; overflow: hidden;">${html}</div>${headChunk.bodyTags}</body>
</html>`
}
