import { Buffer } from 'node:buffer'
import type { ParsedURL } from 'ufo'
import type { FontConfig, SatoriTransformer, VNode } from '../../../../types'
import { base64ToArrayBuffer, readPublicAsset } from '../../utils'
import { useStorage } from '#internal/nitro'

const cachedFonts: Record<string, any> = {}

export async function loadFont(font: FontConfig) {
  let fontKey = font as string
  if (typeof font === 'object')
    fontKey = `${font.name}:${font.weight}`

  if (cachedFonts[fontKey])
    return cachedFonts[fontKey]

  // fetch local inter
  const [name, weight] = fontKey.split(':')

  let data
  // check cache first
  const storageKey = `assets:nuxt-og-imagee:font:${fontKey}`
  if (await useStorage().hasItem(storageKey))
    data = base64ToArrayBuffer(await useStorage().getItem<ArrayBuffer>(storageKey))

  // avoid hitting google fonts api if we don't need to
  if (!data && name === 'Inter' && ['400', '700'].includes(weight)) {
    // check cache first
    data = await readPublicAsset(`/inter-latin-ext-${weight}-normal.woff`)
  }

  // fetch local fonts
  if (typeof font === 'object') {
    data = await readPublicAsset(font.path)
    if (!data) {
      data = await globalThis.$fetch<ArrayBuffer>(font.path, {
        responseType: 'arrayBuffer',
      })
    }
  }

  if (!data) {
    const fontUrl = await globalThis.$fetch<string>('/api/og-image-font', {
      query: { name, weight },
    })
    data = await globalThis.$fetch<ArrayBuffer>(fontUrl, {
      responseType: 'arrayBuffer',
    })
  }

  cachedFonts[fontKey] = { name, weight: Number(weight), data, style: 'normal' }
  await useStorage().setItem(storageKey, Buffer.from(data).toString('base64'))
  // convert data to string
  return cachedFonts[fontKey]
}

export async function walkSatoriTree(url: ParsedURL, node: VNode, plugins: SatoriTransformer[]) {
  if (!node.props?.children)
    return
  // remove empty children
  if (Array.isArray(node.props.children) && node.props.children.length === 0) {
    delete node.props.children
    return
  }
  // walk tree of nodes
  for (const child of node.props.children || []) {
    if (child) {
      for (const plugin of plugins) {
        if (plugin.filter(child))
          await plugin.transform(child)
      }
      await walkSatoriTree(url, child, plugins)
    }
  }
}

export function defineSatoriTransformer(transformer: (url: ParsedURL) => SatoriTransformer) {
  return transformer
}
