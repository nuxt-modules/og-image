import { Buffer } from 'node:buffer'
import type { H3Event } from 'h3'
import type { FontConfig } from '../../types'
import { base64ToArrayBuffer } from '../env/assets'
import { fontCache } from './cache'
import { useStorage } from '#imports'

export async function loadFont(e: H3Event, font: FontConfig) {
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
      data = await e.$fetch(font.path, {
        baseURL: useNitroOrigin(e).replace('https', 'http'),
        responseType: 'arrayBuffer',
      })
    }
    else {
      data = await e.$fetch(`/__og-image__/font/${name}/${weight}.ttf`, {
        responseType: 'arrayBuffer',
      })
    }
  }

  fontCache[fontKey] = { name, weight: Number(weight), data, style: 'normal' }
  await useStorage().setItem(storageKey, Buffer.from(data).toString('base64'))
  // convert data to string
  return fontCache[fontKey]
}
