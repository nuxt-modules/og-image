import { fileURLToPath } from 'node:url'
import { promises as fsp } from 'node:fs'
import type { ParsedURL } from 'ufo'
import { dirname, resolve } from 'pathe'
import type { SatoriTransformer, VNode } from '../../../../types'
import { useStorage } from '#internal/nitro'
import { getAsset } from '#internal/nitro/virtual/public-assets'
import { publicDirs } from '#nuxt-og-image/config'

const cachedFonts: Record<string, any> = {}

export async function readPublicAsset(file: string) {
  const serverDir = dirname(fileURLToPath(import.meta.url))
  const meta = getAsset(file)
  if (meta) {
    const file = resolve(serverDir, meta.path)
    return { meta, file: await fsp.readFile(file) }
  }
  for (const dir of publicDirs) {
    try {
      return { file: await fsp.readFile(resolve(`${dir}${file}`)) }
    }
    catch (e) {}
  }
  return null
}
export async function readPublicAssetBase64(file: string) {
  const asset = await readPublicAsset(file)
  if (asset) {
    let type = asset.meta.type
    if (!type) {
      // guess type from file name
      const ext = file.split('.').pop()
      if (ext === 'svg')
        type = 'image/svg+xml'
      else if (ext === 'png')
        type = 'image/png'
      else if (ext === 'jpg' || ext === 'jpeg')
        type = 'image/jpeg'
    }
    return `data:${type};base64,${asset.file}`
  }
}

export async function loadFont(url: ParsedURL, font: string) {
  if (cachedFonts[font])
    return cachedFonts[font]
  const [name, weight] = font.split(':')

  // avoid hitting google fonts api if we don't need to
  if (name === 'Inter' && ['400', '700'].includes(weight)) {
    const data = await readPublicAsset(`/inter-latin-ext-${weight}-normal.woff`)
    if (data) {
      // something weird going on with 400
      return (cachedFonts[font] = { name, weight: weight === '400' ? '500' : weight, data: data.file, style: 'normal' })
    }
  }

  const fontUrl = await $fetch<string>('/api/og-image-font', {
    query: { name, weight },
  })

  let data
  // @todo allow custom cache config
  const storageKey = `nuxt-og-image:font:${font}`
  const hasStoredFont = await useStorage().hasItem(storageKey)
  if (!hasStoredFont) {
    data = await $fetch<ArrayBuffer>(fontUrl, {
      responseType: 'arrayBuffer',
    })
    await useStorage().setItem(storageKey, data)
  }
  else {
    data = await useStorage().getItem<ArrayBuffer>(storageKey)
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
          await plugin.transform(child)
      }
      await walkSatoriTree(url, child, plugins)
    }
  }
}

export function defineSatoriTransformer(transformer: (url: ParsedURL) => SatoriTransformer) {
  return transformer
}
