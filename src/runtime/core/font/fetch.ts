import { createError } from 'h3'
import type { FontConfig, OgImageRenderEventContext } from '../../types'
import { fontCache } from './cache'
import { useNitroOrigin, useStorage } from '#imports'
import { assets } from '#internal/nitro/virtual/server-assets'

export async function loadFont({ e }: OgImageRenderEventContext, font: FontConfig) {
  const fontKey = font.key || `${font.name}:${font.weight}`
  if (fontCache[fontKey])
    return fontCache[fontKey]

  const { name, weight } = font

  let data: ArrayBuffer | undefined
  if (import.meta.dev || import.meta.prerender) {
    // check cache first, this uses Nuxt server assets
    if (font.key && await assets.hasItem(font.key))
      data = await assets.getItemRaw<ArrayBuffer>(font.key)
  }
  // fetch local fonts
  if (!data) {
    if (font.path) {
      if (import.meta.dev || import.meta.prerender) {
        // we need to read the file using unstorage
        const key = `root:public${font.path.replace('./', ':').replace('/', ':')}`
        if (await useStorage().hasItem(key))
          data = await useStorage().getItemRaw(key)
        // fallback to fetch
        if (!data) {
          // local fetch for public asset
          data = await e.$fetch(font.path, {
            responseType: 'arrayBuffer',
          })
        }
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
      })
    }
  }
  if (data) {
    fontCache[fontKey] = { name, weight: Number(weight), data, style: 'normal' }
    // convert data to string
    return fontCache[fontKey]
  }
  return createError({
    statusCode: 500,
    statusMessage: `Failed to fetch font: ${fontKey}`,
  })
}
