import { fileURLToPath } from 'node:url'
import { promises as fsp } from 'node:fs'
import type { SatoriOptions } from 'satori'
import { dirname, resolve } from 'pathe'
import type { ParsedURL } from 'ufo'
import { withBase } from 'ufo'
import type { SatoriTransformer, VNode } from '../../../../types'
import { getAsset } from '#internal/nitro/virtual/public-assets'

export async function parseFont(url: ParsedURL, font: SatoriOptions['fonts'][number] & { publicPath?: string }) {
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
