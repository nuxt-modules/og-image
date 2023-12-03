import { Buffer } from 'node:buffer'
import { createError } from 'h3'
import type { FontConfig, H3EventOgImageRender } from '../../types'
import { base64ToArrayBuffer } from '../env/assets'
import { fontCache } from './cache'
import { useNitroOrigin, useStorage } from '#imports'

export async function loadFont({ e }: H3EventOgImageRender, font: FontConfig) {
  const fontKey = `${font.name}:${font.weight}`
  const storageKey = `assets:nuxt-og-image:font:${fontKey}`
  if (fontCache[fontKey])
    return fontCache[fontKey]

  // fetch local inter
  const [name, weight] = fontKey.split(':')

  let data: ArrayBuffer | undefined
  // check cache first
  if (await useStorage().hasItem(storageKey))
    data = base64ToArrayBuffer(await useStorage().getItem<ArrayBuffer>(storageKey))
  // fetch local fonts
  if (!data) {
    if (font.path) {
      if (import.meta.prerender) {
        // we need to read the file using unstorage
        const key = `root:public${font.path.replace('./', ':').replace('/', ':')}`
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
      })
    }
  }
  if (data) {
    fontCache[fontKey] = { name, weight: Number(weight), data, style: 'normal' }
    await useStorage().setItem(storageKey, Buffer.from(data).toString('base64'))
    // convert data to string
    return fontCache[fontKey]
  }
  return createError({
    statusCode: 500,
    statusMessage: `Failed to fetch font: ${fontKey}`,
  })
}
