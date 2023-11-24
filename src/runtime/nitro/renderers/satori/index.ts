import { html as convertHtmlToSatori } from 'satori-html'
import type { SatoriOptions } from 'satori'
import type { FontConfig, Renderer } from '../../../types'
import { fetchHTML } from '../../utils'
import { loadFont, walkSatoriTree } from './utils'
import imageSrc from './plugins/imageSrc'
import twClasses from './plugins/twClasses'
import flex from './plugins/flex'
import emojis from './plugins/emojis'
import encoding from './plugins/encoding'
import loadPngCreator from '#nuxt-og-image/png'
import loadSatori from '#nuxt-og-image/satori'
import { useRuntimeConfig } from '#imports'

const satoriFonts: any[] = []
let fontLoadPromise: Promise<any> | null = null
function loadFonts(baseURL: string, fonts: FontConfig[]) {
  if (fontLoadPromise)
    return fontLoadPromise

  return (fontLoadPromise = Promise.all(fonts.map(font => loadFont(baseURL, font))))
}

const SatoriRenderer: Renderer = {
  name: 'satori',
  createPng: async function createPng(options) {
    const svg = await this.createSvg(options)
    const pngCreator = await loadPngCreator()
    return pngCreator(svg, options)
  },

  createVNode: async function createVNode(options) {
    const html = options.html || await fetchHTML(options)
    // get the body content of the html
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] || html

    // scan html for all css links and load them
    const satoriTree = convertHtmlToSatori(body)
    // process the tree
    await walkSatoriTree(satoriTree, [
      emojis,
      twClasses,
      imageSrc,
      flex,
      encoding,
    ], options)
    // @todo allow users to hook into the vnode tree

    return satoriTree
  },

  createSvg: async function createSvg(options) {
    const { fonts, satoriOptions } = useRuntimeConfig()['nuxt-og-image']
    const vnodes = await this.createVNode(options)

    if (!satoriFonts.length)
      satoriFonts.push(...await loadFonts(options.requestOrigin, fonts))

    const satori = await loadSatori()
    return await satori(vnodes, <SatoriOptions> {
      ...satoriOptions,
      fonts: satoriFonts,
      embedFont: true,
      width: options.width!,
      height: options.height!,
    })
  },
}

export default SatoriRenderer
