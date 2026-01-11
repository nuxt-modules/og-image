import type { OgImageRenderEventContext, Renderer, ResolvedFontConfig } from '../../../types'
import { fontCache } from '#og-image-cache'
import { defu } from 'defu'
import { sendError } from 'h3'
import { normaliseFontInput } from '../../../shared'
import { useOgImageRuntimeConfig } from '../../utils'
import { loadFont } from '../satori/font'
import { useTakumi } from './instances'
import { createTakumiNodes } from './nodes'

const fontPromises: Record<string, Promise<ResolvedFontConfig>> = {}

async function resolveFonts(event: OgImageRenderEventContext) {
  const { fonts } = useOgImageRuntimeConfig()
  const normalisedFonts = normaliseFontInput([...event.options.fonts || [], ...fonts])
  const localFontPromises: Promise<ResolvedFontConfig>[] = []
  const preloadedFonts: ResolvedFontConfig[] = []

  if (fontCache) {
    for (const font of normalisedFonts) {
      if (await fontCache.hasItem(font.cacheKey)) {
        font.data = (await fontCache.getItemRaw(font.cacheKey)) || undefined
        preloadedFonts.push(font)
      }
      else {
        if (!fontPromises[font.cacheKey]) {
          fontPromises[font.cacheKey] = loadFont(event, font).then(async (_font) => {
            if (_font?.data)
              await fontCache?.setItemRaw(_font.cacheKey, _font.data)
            return _font
          })
        }
        localFontPromises.push(fontPromises[font.cacheKey]!)
      }
    }
  }
  const awaitedFonts = await Promise.all(localFontPromises)
  return [...preloadedFonts, ...awaitedFonts].map(_f => ({
    name: _f.name,
    data: _f.data,
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _takumiRenderer: any

async function getTakumiRenderer(fonts: Array<{ name: string, data?: BufferSource }>) {
  if (_takumiRenderer)
    return _takumiRenderer
  const Renderer = await useTakumi()
  _takumiRenderer = new Renderer({ fonts: fonts.filter(f => f.data) })
  return _takumiRenderer
}

async function createImage(event: OgImageRenderEventContext, format: 'png' | 'jpeg' | 'webp') {
  const { options } = event

  const [nodes, fonts] = await Promise.all([
    createTakumiNodes(event),
    resolveFonts(event),
  ])

  // @ts-expect-error runtime hook
  await event._nitro.hooks.callHook('nuxt-og-image:takumi:nodes', nodes, event)

  const renderer = await getTakumiRenderer(fonts)

  return renderer.render(nodes, defu(options.takumi, {
    width: options.width!,
    height: options.height!,
    format,
  })).catch((err: Error) => sendError(event.e, err, import.meta.dev))
}

const TakumiRenderer: Renderer = {
  name: 'takumi',
  supportedFormats: ['png', 'jpeg', 'jpg'],

  async createImage(e) {
    switch (e.extension) {
      case 'png':
        return createImage(e, 'png')
      case 'jpeg':
      case 'jpg':
        return createImage(e, 'jpeg')
    }
  },

  async debug(e) {
    const nodes = await createTakumiNodes(e)
    return { nodes }
  },
}

export default TakumiRenderer
