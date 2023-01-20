import type { ParsedURL } from 'ufo'
import type { SatoriTransformer, VNode } from '../../../../types'
import { useStorage } from '#internal/nitro'

const cachedFonts: Record<string, any> = {}

export async function loadFont(url: ParsedURL, font: string) {
  if (cachedFonts[font])
    return cachedFonts[font]
  const [name, weight] = font.split(':')

  const fontUrl = await $fetch<string>('/api/og-image-font', {
    query: { name, weight },
  })

  let data
  // @todo allow custom cache config
  const storageKey = `nuxt-og-image:font:${font}`
  const hasStoredFont = await useStorage().hasItem(storageKey)
  if (!hasStoredFont) {
    const res = await fetch(fontUrl)
    // create arraybuffer
    data = await res.arrayBuffer()
    await useStorage().setItem(storageKey, data)
  }
  else {
    data = await useStorage().getItem(storageKey)
  }
  // convert data to string
  return (cachedFonts[font] = { name, weight, data, style: 'normal' })
}

export async function walkSatoriTree(url: ParsedURL, node: VNode, plugins: SatoriTransformer[]) {
  if (!node.props?.children)
    return
  // walk tree of nodes
  for (const child of node.props.children || []) {
    if (child) {
      for (const plugin of plugins) {
        if (plugin.filter(child))
          await plugin.transform(child, url)
      }
      await walkSatoriTree(url, child, plugins)
    }
  }
}

export function defineSatoriTransformer(transformer: (url: ParsedURL) => SatoriTransformer) {
  return transformer
}
