import { html as convertHtmlToSatori } from 'satori-html'
import { parseURL } from 'ufo'
import twemoji from 'twemoji'
import type { FontConfig, Renderer } from '../../../../types'
import { loadFont, walkSatoriTree } from './utils'
import imageSrc from './plugins/imageSrc'
import twClasses from './plugins/twClasses'
import flex from './plugins/flex'
import emojis from './plugins/emojis'
import encoding from './plugins/encoding'
import loadPngCreator from '#nuxt-og-image/png'
import loadSatori from '#nuxt-og-image/satori'
import { useRuntimeConfig } from '#imports'
import { useNitroApp } from '#internal/nitro'

const satoriFonts: any[] = []
let fontLoadPromise: Promise<any> | null = null
function loadFonts(fonts: FontConfig[]) {
  if (fontLoadPromise)
    return fontLoadPromise

  return (fontLoadPromise = Promise.all(fonts.map(font => loadFont(font))))
}

export default <Renderer> {
  name: 'satori',
  createPng: async function createPng(baseUrl, options) {
    const svg = await this.createSvg(baseUrl, options)
    const pngCreator = await loadPngCreator()
    return pngCreator(svg, { baseUrl, ...options })
  },

  createVNode: async function createVNode(baseUrl, options) {
    const url = parseURL(baseUrl)

    const nitroApp = useNitroApp()
    const html = await (await nitroApp.localFetch(`/api/og-image-html?path=${url.pathname}&options=${encodeURI(JSON.stringify(options))}`)).text()
    // get the body content of the html
    let body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] || ''

    try {
      body = twemoji.parse(body!, {
        folder: 'svg',
        ext: '.svg',
      })
    }
    catch (e) {}

    // scan html for all css links and load them
    const satoriTree = convertHtmlToSatori(body)
    // process the tree
    await walkSatoriTree(url, satoriTree, [
      // @todo add user land support
      emojis(url),
      twClasses(url),
      imageSrc(url),
      flex(url),
      encoding(url),
    ])
    return satoriTree
  },

  createSvg: async function createSvg(baseUrl, options) {
    const { fonts, satoriOptions } = useRuntimeConfig()['nuxt-og-image']
    const vnodes = await this.createVNode(baseUrl, options)

    if (!satoriFonts.length)
      satoriFonts.push(...await loadFonts(fonts))

    const satori = await loadSatori()
    return await satori(vnodes, {
      ...satoriOptions,
      baseUrl,
      fonts: satoriFonts,
      embedFont: true,
      width: options.width!,
      height: options.height!,
    })
  },
}
