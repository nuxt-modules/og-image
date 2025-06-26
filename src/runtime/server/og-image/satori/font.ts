import type { OgImageRenderEventContext, ResolvedFontConfig } from '../../../types'
import { useNitroOrigin } from '#site-config/server/composables'
import { useStorage } from 'nitropack/runtime'
import { prefixStorage } from 'unstorage'

export const assets = prefixStorage(useStorage(), '/assets')

export async function loadFont({ e, publicStoragePath }: OgImageRenderEventContext, font: ResolvedFontConfig): Promise<ResolvedFontConfig> {
  const { name, weight } = font
  if (font.data)
    return font

  if (font.key && await assets.hasItem(font.key)) {
    let fontData = await assets.getItem(font.key)
    // if buffer
    if (fontData instanceof Uint8Array) {
      const decoder = new TextDecoder()
      fontData = decoder.decode(fontData)
    }
    // fontData is a base64 string, need to turn it into a buffer
    // buf is a string need to convert it to a buffer
    font.data = Buffer.from(fontData!, 'base64')
    return font
  }

  // TODO we may not need this anymore
  let data: ArrayBuffer | undefined
  // fetch local fonts
  if (font.path) {
    if (import.meta.dev || import.meta.prerender) {
      const key = `${publicStoragePath}${font.path.replace('./', ':').replace('/', ':')}`
      if (await useStorage().hasItem(key))
        data = await useStorage().getItemRaw(key)
    }
    else {
      data = await e.$fetch(font.path, {
        baseURL: useNitroOrigin(e),
        responseType: 'arrayBuffer',
      })
    }
  }
  else {
    data = await e.$fetch(`/__og-image__/font/${name}/${weight}.ttf`, {
      responseType: 'arrayBuffer',
      query: {
        font,
      },
    })
  }
  font.data = data
  return font
}
