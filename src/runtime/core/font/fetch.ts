import { createError } from 'h3'
import type { FontConfig, H3EventOgImageRender } from '../../types'
import { base64ToArrayBuffer } from '../env/assets'
import { fontCache } from './cache'
import { useNitroOrigin, useStorage } from '#imports'
import { assets } from '#internal/nitro/virtual/server-assets'

export async function loadFont({ e }: H3EventOgImageRender, font: FontConfig) {
  const fontKey = font.key || `${font.name}:${font.weight}`
  const storageKey = `assets:nuxt-og-image:fonts:${fontKey}`
  if (fontCache[fontKey])
    return fontCache[fontKey]

  const { name, weight } = font

  let data: ArrayBuffer | undefined
  // check cache first, this uses Nuxt server assets
  if (await assets.hasItem(storageKey))
    data = base64ToArrayBuffer(await assets.getItem<ArrayBuffer>(storageKey))
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
