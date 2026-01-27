import type { FontConfig, OgImageRenderEventContext } from '../../../types'
import { tw4Breakpoints, tw4Colors, tw4FontVars } from '#og-image-virtual/tw4-theme.mjs'
import resolvedFonts from '#og-image/fonts'
import { createHeadCore } from '@unhead/vue'
import { renderSSRHead } from '@unhead/vue/server'
import { createError } from 'h3'
import { fetchIsland } from '../../util/kit'
import { applyEmojis } from '../satori/transforms/emojis'

// Build Tailwind config from extracted TW4 theme
function buildTailwindConfig() {
  const theme: Record<string, any> = {}

  // Add colors
  if (Object.keys(tw4Colors).length > 0)
    theme.colors = tw4Colors

  // Add font families
  const fontFamily: Record<string, string[]> = {}
  if (tw4FontVars['font-sans'])
    fontFamily.sans = [tw4FontVars['font-sans']]
  if (tw4FontVars['font-serif'])
    fontFamily.serif = [tw4FontVars['font-serif']]
  if (tw4FontVars['font-mono'])
    fontFamily.mono = [tw4FontVars['font-mono']]
  if (Object.keys(fontFamily).length > 0)
    theme.fontFamily = fontFamily

  // Add breakpoints (screens)
  if (Object.keys(tw4Breakpoints).length > 0) {
    theme.screens = Object.fromEntries(
      Object.entries(tw4Breakpoints).map(([k, v]) => [k, `${v}px`]),
    )
  }

  return { theme: { extend: theme } }
}

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

  head.push({
    style: [
      {
        // default font is the first font family
        innerHTML: `body { font-family: \'${defaultFontFamily}\', sans-serif;  }`,
      },
      {
        innerHTML: `html, body {
    margin: 0;
    padding: 0;
    width: ${scaledWidth}px;
    height: ${scaledHeight}px;
    overflow: hidden;
    background-color: ${(options.props as Record<string, any>)?.colorMode === 'dark' ? '#1b1b1b' : '#fff'};
}
.og-scale-wrapper {
    transform: scale(${scale});
    transform-origin: top left;
    width: ${options.width}px;
    height: ${options.height}px;
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
      ...fonts.map((font) => {
        const cacheKey = `${font.family}-${font.weight}-${font.style}`
        return `
          @font-face {
            font-family: '${font.family.replaceAll('+', ' ')}';
            font-style: ${font.style};
            font-weight: ${font.weight};
            src: url('/_og/f/${cacheKey}') format('truetype');
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
        innerHTML: `tailwind.config = ${JSON.stringify(buildTailwindConfig())}`,
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
<body ${headChunk.bodyAttrs}>${headChunk.bodyTagsOpen}<div class="og-scale-wrapper" data-v-inspector-ignore="true">${html}</div>${headChunk.bodyTags}</body>
</html>`
}
