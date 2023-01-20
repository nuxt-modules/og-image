import { html as convertHtmlToSatori } from 'satori-html'
import satori from 'satori'
import { parseURL } from 'ufo'
import { Resvg } from '@resvg/resvg-js'
import twemoji from 'twemoji'
import type { Provider } from '../../../../types'
import { parseFont, walkSatoriTree } from './utils'
import imageSrc from './plugins/imageSrc'
import twClasses from './plugins/twClasses'
import flex from './plugins/flex'
import emojis from './plugins/emojis'
import { satoriFonts, satoriOptions } from '#nuxt-og-image/config'

export default <Provider> {
  name: 'satori',
  createPng: async function createPng(baseUrl, options) {
    const svg = await this.createSvg(baseUrl, options)
    const resvg = new Resvg(svg, {})
    const pngData = resvg.render()
    return pngData.asPng()
  },

  createVNode: async function createVNode(baseUrl, options) {
    const url = parseURL(baseUrl)
    const html = await $fetch<string>(url.pathname)
    // get the body content of the html
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1]

    const emojiedFont = twemoji.parse(body!, {
      folder: 'svg',
      ext: '.svg',
    })

    satoriOptions.fonts = satoriOptions.fonts || []
    for (const font of satoriFonts)
      satoriOptions.fonts.push(await parseFont(url, font))
    // scan html for all css links and load them
    const satoriTree = convertHtmlToSatori(emojiedFont!)
    // process the tree
    await walkSatoriTree(url, satoriTree, [
      // @todo add user land support
      emojis(url),
      twClasses(url),
      imageSrc(url),
      flex(url),
    ])
    return satoriTree
  },

  createSvg: async function createSvg(baseUrl, options) {
    const vnodes = await this.createVNode(baseUrl, options)
    return await satori(vnodes, {
      ...satoriOptions,
      width: options.width!,
      height: options.height!,
    })
  },
}
