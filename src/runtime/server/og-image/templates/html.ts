import type { FontConfig, OgImageRenderEventContext } from '../../../types'
import resolvedFonts from '#og-image/fonts'
import { createHeadCore } from '@unhead/vue'
import { renderSSRHead } from '@unhead/vue/server'
import { createError } from 'h3'
import { fetchIsland } from '../../util/kit'
import { applyEmojis } from '../core/transforms/emojis'

export async function html(ctx: OgImageRenderEventContext) {
  const { options } = ctx
  const fonts = resolvedFonts as FontConfig[]

  if (!options.component) {
    throw createError({
      statusCode: 500,
      statusMessage: `[Nuxt OG Image] Rendering an invalid component. Received options: ${JSON.stringify(options)}.`,
    })
  }
  const island = await fetchIsland(ctx.e, ctx.options.component!, typeof ctx.options.props !== 'undefined' ? ctx.options.props as Record<string, any> : ctx.options)
  const head = createHeadCore()
  head.push(island.head)

  let defaultFontFamily = 'sans-serif'
  const firstFont = fonts[0]
  if (firstFont)
    defaultFontFamily = firstFont.family.replaceAll('+', ' ')

  await applyEmojis(ctx, island)
  let html = island.html

  const scale = (options.props as Record<string, any>)?.scale || 1
  const scaledWidth = Math.round(Number(options.width) * scale)
  const scaledHeight = Math.round(Number(options.height) * scale)

  const fontFaces = fonts.map((font) => {
    const ext = font.src.split('.').pop()?.toLowerCase()
    const format = ext === 'woff2' ? 'woff2' : ext === 'woff' ? 'woff' : 'truetype'
    return `@font-face {
  font-family: '${font.family.replaceAll('+', ' ')}';
  font-style: ${font.style};
  font-weight: ${font.weight};
  src: url('${font.src}') format('${format}');
}`
  }).join('\n')

  const bgColor = (options.props as Record<string, any>)?.colorMode === 'dark' ? '#1b1b1b' : '#fff'

  head.push({
    style: [
      {
        innerHTML: `/* reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
img, svg { display: block; max-width: 100%; }

/* viewport */
html, body {
  width: ${scaledWidth}px;
  height: ${scaledHeight}px;
  overflow: hidden;
  font-family: '${defaultFontFamily}', sans-serif;
  background-color: ${bgColor};
}

/* scale wrapper */
.og-scale-wrapper {
  transform: scale(${scale});
  transform-origin: top left;
  width: ${options.width}px;
  height: ${options.height}px;
}
.og-scale-wrapper > :first-child {
  width: 100%;
  height: 100%;
}

/* match satori flex defaults for divs */
div { display: flex; }
div:has(div, p, ul, ol, li, blockquote, pre, hr, table, dl) {
  flex-direction: column;
}
div:not(:has(div, p, ul, ol, li, blockquote, pre, hr, table, dl)) {
  flex-wrap: wrap;
  gap: 12px;
}

svg[data-emoji] { display: inline-block; }

/* fonts */
${fontFaces}`,
      },
    ],
    meta: [
      { charset: 'utf-8' },
    ],
  })

  // need to remove ALL script tags from the html
  html = html.replaceAll(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  const headChunk = await renderSSRHead(head)
  return `<!DOCTYPE html>
<html ${headChunk.htmlAttrs}>
<head>${headChunk.headTags}</head>
<body ${headChunk.bodyAttrs}>${headChunk.bodyTagsOpen}<div class="og-scale-wrapper" data-v-inspector-ignore="true">${html}</div>${headChunk.bodyTags}</body>
</html>`
}
