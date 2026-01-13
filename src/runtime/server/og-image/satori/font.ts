import type { OgImageRenderEventContext, ResolvedFontConfig } from '../../../types'
import { getNitroOrigin } from '#site-config/server/composables'
import { useStorage } from 'nitropack/runtime'
import { prefixStorage } from 'unstorage'

export const assets = prefixStorage(useStorage(), '/assets')

export async function loadFont({ e, publicStoragePath }: OgImageRenderEventContext, font: ResolvedFontConfig): Promise<ResolvedFontConfig> {
  const { name, weight } = font
  if (font.data)
    return font

  if (font.key) {
    let fontData: string | Uint8Array | null = null
    if (await assets.hasItem(font.key)) {
      fontData = await assets.getItem(font.key) as any as string | Uint8Array
    }
    // zeroRuntime: fonts available via devStorage during dev/prerender
    else if (import.meta.dev || import.meta.prerender) {
      const fontFileName = font.key.split(':').pop()
      if (fontFileName) {
        const fontsStorage = useStorage('nuxt-og-image:fonts')
        if (await fontsStorage.hasItem(fontFileName))
          fontData = await fontsStorage.getItem(fontFileName) as string | Uint8Array
      }
    }
    if (fontData) {
      // if buffer
      if (fontData instanceof Uint8Array) {
        const decoder = new TextDecoder()
        fontData = decoder.decode(fontData)
      }
      // fontData is a base64 string, need to turn it into a buffer
      font.data = Buffer.from(String(fontData), 'base64')
      return font
    }
  }

  // TODO we may not need this anymore
  let data: ArrayBuffer | undefined
  // fetch local fonts
  if (font.path) {
    if (import.meta.dev || import.meta.prerender) {
      const key = `${publicStoragePath}${font.path.replace('./', ':').replace('/', ':')}`
      if (await useStorage().hasItem(key))
        data = (await useStorage().getItemRaw(key)) || undefined
    }
    else {
      data = await e.$fetch(font.path, {
        baseURL: getNitroOrigin(e),
        responseType: 'arrayBuffer',
      })
    }
  }
  else {
    data = await e.$fetch(`/_og/f/${name}/${weight}.ttf`, {
      responseType: 'arrayBuffer',
      query: {
        font,
      },
    })
  }
  font.data = data
  return font
}
