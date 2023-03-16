import type { ParsedURL } from 'ufo'
import type { SatoriTransformer, VNode } from '../../../../types'
import { base64ToArrayBuffer, readPublicAsset } from '../../utils'
import { useStorage } from '#internal/nitro'

const cachedFonts: Record<string, any> = {}

export async function loadFont(font: string) {
  if (cachedFonts[font])
    return cachedFonts[font]

  let data

  // check cache first
  const storageKey = `assets:nuxt-og-imagee:font:${font}`
  if (await useStorage().hasItem(storageKey)) {
    data = base64ToArrayBuffer(await useStorage().getItem<ArrayBuffer>(storageKey))
    return (cachedFonts[font] = { name: font, data, style: 'normal' })
  }

  // fetch local inter
  const [name, weight] = font.split(':')
  // avoid hitting google fonts api if we don't need to
  if (name === 'Inter' && ['400', '700'].includes(weight)) {
    // check cache first
    const data = await readPublicAsset(`/inter-latin-ext-${weight}-normal.woff`)
    if (data)
      return (cachedFonts[font] = { name, weight: Number(weight), data, style: 'normal' })
  }

  if (!data) {
    const fontUrl = await globalThis.$fetch<string>('/api/og-image-font', {
      query: { name, weight },
    })
    data = await globalThis.$fetch<ArrayBuffer>(fontUrl, {
      responseType: 'arrayBuffer',
    })
  }
  await useStorage().setItem(storageKey, Buffer.from(data).toString('base64'))
  // convert data to string
  return (cachedFonts[font] = { name, weight: Number(weight), data, style: 'normal' })
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
