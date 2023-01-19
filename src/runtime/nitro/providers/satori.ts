import { fileURLToPath } from 'node:url'
import { promises as fsp } from 'node:fs'
import { html as convertHtmlToSatori } from 'satori-html'
import type { SatoriOptions } from 'satori'
import satori from 'satori'
import { parseURL, withBase } from 'ufo'
import { Resvg } from '@resvg/resvg-js'
import { dirname, resolve } from 'pathe'
import type { Provider } from '../../../types'
import { getAsset } from '#internal/nitro/virtual/public-assets'
import { satoriFonts, satoriOptions } from '#nuxt-og-image/config'

export default <Provider> {
  name: 'satori',
  createPng: async function createPng(baseUrl, options) {
    const svg = await this.createSvg(baseUrl, options)
    const resvg = new Resvg(svg, {})
    const pngData = resvg.render()
    return pngData.asPng()
  },

  createSvg: async function createSvg(baseUrl, options) {
    const url = parseURL(baseUrl)
    const html = await $fetch<string>(url.pathname)
    // get the body content of the html
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1]
    const parseFont = async (font: SatoriOptions['fonts'][number] & { publicPath?: string }) => {
      if (typeof font.publicPath === 'string') {
        const file = getAsset(font.publicPath)
        if (file) {
          const serverDir = dirname(fileURLToPath(import.meta.url))
          font.data = await fsp.readFile(resolve(serverDir, file.path))
        }
        // fallback to fetch
        if (!font.data)
          font.data = await (await $fetch<Blob>(withBase(font.publicPath, `${url.protocol}//${url.host}`))).arrayBuffer()
      }
      return font
    }
    satoriOptions.fonts = satoriOptions.fonts || []
    for (const font of satoriFonts)
      satoriOptions.fonts.push(await parseFont(font))
    // scan html for all css links and load them
    const satoriTree = convertHtmlToSatori(body!)
    return await satori(satoriTree, {
      ...satoriOptions,
      width: options.width!,
      height: options.height!,
    })
  },
}
