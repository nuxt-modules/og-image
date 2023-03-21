import { html as convertHtmlToSatori } from 'satori-html'
import { parseURL } from 'ufo'
import twemoji from 'twemoji'
import type { Renderer } from '../../../../types'
import { loadFont, walkSatoriTree } from './utils'
import imageSrc from './plugins/imageSrc'
import twClasses from './plugins/twClasses'
import flex from './plugins/flex'
import emojis from './plugins/emojis'
import encoding from './plugins/encoding'
import loadSvg2png from '#nuxt-og-image/svg2png'
import loadSatori from '#nuxt-og-image/satori'
import { useRuntimeConfig } from '#internal/nitro'

const satoriFonts: any[] = []
let fontLoadPromise: Promise<any> | null = null
function loadFonts(fonts: string[]) {
  if (fontLoadPromise)
    return fontLoadPromise

  return (fontLoadPromise = Promise.all(fonts.map(font => loadFont(font))))
}

export default <Renderer> {
  name: 'satori',
  createPng: async function createPng(baseUrl, options) {
    const svg = await this.createSvg(baseUrl, options)
    const svg2png = await loadSvg2png()
    return svg2png(svg, { baseUrl, ...options })
  },

  createVNode: async function createVNode(baseUrl, options) {
    const url = parseURL(baseUrl)
    const html = await globalThis.$fetch<string>('/api/og-image-html', {
      query: { path: url.pathname, options: JSON.stringify(options) },
    })
    // get the body content of the html
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1]

    const emojiedFont = twemoji.parse(body!, {
      folder: 'svg',
      ext: '.svg',
    })

    // scan html for all css links and load them
    const satoriTree = convertHtmlToSatori(emojiedFont!)
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
