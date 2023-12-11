import { createHeadCore } from '@unhead/vue'
import { renderSSRHead } from '@unhead/ssr'
import type { FontConfig, OgImageRenderEventContext } from '../../types'
import { normaliseFontInput, useOgImageRuntimeConfig } from '../../utils'
import { applyEmojis } from './applyEmojis'
import { fetchIsland } from './fetchIsland'
import { theme } from '#nuxt-og-image/unocss-config.mjs'

export async function devIframeTemplate(ctx: OgImageRenderEventContext) {
  const { options } = ctx
  const { fonts } = useOgImageRuntimeConfig()
  // const scale = query.scale
  // const mode = query.mode || 'light'
  // extract the options from the original path

  const island = await fetchIsland(ctx)
  const head = createHeadCore()
  head.push(island.head)

  let defaultFontFamily = 'sans-serif'
  const normalisedFonts = normaliseFontInput([...options.fonts || [], ...fonts])
  const firstFont = normalisedFonts[0] as FontConfig
  if (firstFont)
    defaultFontFamily = firstFont.name

  await applyEmojis(ctx, island)
  let html = island.html

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
    transform: scale(${options.props.scale || 1});
    transform-origin: top left;
    max-height: 100vh;
    position: relative;
    width: ${options.width}px;
    height: ${options.height}px;
    overflow: hidden;
    background-color: ${options.props.colorMode === 'dark' ? '#1b1b1b' : '#fff'};
}
div {
  display: flex;
  flex-direction: column;
}
svg[data-emoji] {
  display: inline-block;
}
`,
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
      // have to add each weight as their own stylesheet
      // we should use the local font file no?
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
  return `<!DOCTYPE html>
<html ${headChunk.htmlAttrs}>
<head>${headChunk.headTags}</head>
<body ${headChunk.bodyAttrs}>${headChunk.bodyTagsOpen}<div data-v-inspector-ignore="true" style="position: relative; display: flex; margin: 0 auto; width: ${options.width}px; height: ${options.height}px; overflow: hidden;">${html}</div>${headChunk.bodyTags}</body>
</html>`
}
