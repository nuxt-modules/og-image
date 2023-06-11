import { Buffer } from 'node:buffer'
import type { FontConfig, RuntimeOgImageOptions, SatoriTransformer, VNode } from '../../../../types'
import { base64ToArrayBuffer, readPublicAsset } from '../../utils'
import { useStorage } from '#imports'

const cachedFonts: Record<string, any> = {}

export async function loadFont(requestOrigin: string, font: FontConfig) {
  const fontKey = `${font.name}:${font.weight}`
  const storageKey = `assets:nuxt-og-image:font:${fontKey}`
  if (cachedFonts[fontKey])
    return cachedFonts[fontKey]

  // fetch local inter
  const [name, weight] = fontKey.split(':')

  let data
  // check cache first
  if (await useStorage().hasItem(storageKey))
    data = base64ToArrayBuffer(await useStorage().getItem<ArrayBuffer>(storageKey))

  // avoid hitting google fonts api if we don't need to
  if (!data && name === 'Inter' && ['400', '700'].includes(weight)) {
    // check cache first
    data = await readPublicAsset(`/inter-latin-ext-${weight}-normal.woff`)
  }

  // fetch local fonts
  if (font.path) {
    data = await readPublicAsset(font.path)
    if (!data) {
      try {
        data = await globalThis.$fetch(font.path, {
          responseType: 'arrayBuffer',
          baseURL: requestOrigin,
        }) as Promise<ArrayBuffer>
      }
      // it can fail
      catch {}
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

export async function walkSatoriTree(node: VNode, plugins: (SatoriTransformer | SatoriTransformer[])[], props: RuntimeOgImageOptions) {
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
      for (const plugin of plugins.flat()) {
        if (plugin.filter(child))
          await plugin.transform(child, props)
      }
      await walkSatoriTree(child, plugins, props)
    }
  }
}

export function defineSatoriTransformer(transformer: SatoriTransformer | SatoriTransformer[]) {
  return transformer
}
