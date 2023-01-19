import { fileURLToPath } from 'node:url'
import { promises as fsp } from 'node:fs'
import { html as convertHtmlToSatori } from 'satori-html'
import type { SatoriOptions } from 'satori'
import satori from 'satori'
import { parseURL } from 'ufo'
import { Resvg } from '@resvg/resvg-js'
import { dirname, resolve } from 'pathe'
import type { Provider } from '../../../types'
import { height, width } from '#nuxt-og-image/config'
import { getAsset } from '#internal/nitro/virtual/public-assets'

export default <Provider> {
  name: 'satori',
  createPng: async function createPng(baseUrl: string) {
    const svg = await this.createSvg(baseUrl)
    const resvg = new Resvg(svg, {})
    const pngData = resvg.render()
    return pngData.asPng()
  },

  createSvg: async function createSvg(baseUrl: string) {
    const url = parseURL(baseUrl)
    const html = await $fetch<string>(url.pathname)
    // get the body content of the html
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1]
    const font = async (weight: number) => {
      let fontData
      const file = getAsset(`/inter-latin-ext-${weight}-normal.woff`)
      if (file) {
        const serverDir = dirname(fileURLToPath(import.meta.url))
        fontData = await fsp.readFile(resolve(serverDir, file.path))
      }
      // fallback to fetch
      if (!fontData)
        fontData = await (await $fetch<Blob>(`${url.protocol}//${url.host}/inter-latin-ext-${weight}-normal.woff`)).arrayBuffer()
      return {
        name: 'Inter',
        // If you don't want to convert your fonts to buffer you can simply pass a font url
        weight,
        style: 'normal',
        data: fontData,
      } as SatoriOptions['fonts'][number]
    }
    // scan html for all css links and load them
    const satoriTree = convertHtmlToSatori(body!)
    return await satori(satoriTree, {
      width,
      height,
      fonts: [
        await font(400),
        await font(700),
      ],
    })
  },
}
