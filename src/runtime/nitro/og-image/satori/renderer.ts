import type { SatoriOptions } from 'satori'
import { defu } from 'defu'
import { createStorage } from 'unstorage'
import lruCacheDriver from 'unstorage/drivers/lru-cache'
import type { OgImageRenderEventContext, Renderer, ResolvedFontConfig } from '../../../types'
import { normaliseFontInput, useOgImageRuntimeConfig } from '../../../shared'
import { loadFont } from './font'
import { createVNodes } from './vnodes'
import { useResvg, useSatori, useSharp } from './instances'
import { theme } from '#nuxt-og-image/unocss-config.mjs'

const fontPromises: Record<string, Promise<ResolvedFontConfig>> = {}

const fontCache = createStorage<BufferSource>({
  driver: lruCacheDriver({ max: 10 }),
})

async function resolveFonts(event: OgImageRenderEventContext) {
  const { fonts } = useOgImageRuntimeConfig()
  const normalisedFonts = normaliseFontInput([...event.options.fonts || [], ...fonts])
  const localFontPromises: Promise<ResolvedFontConfig>[] = []
  const preloadedFonts: ResolvedFontConfig[] = []
  for (const font of normalisedFonts) {
    if (await fontCache.hasItem(font.cacheKey)) {
      font.data = await fontCache.getItemRaw(font.cacheKey)
      preloadedFonts.push(font)
    }
    else {
      if (!fontPromises[font.cacheKey]) {
        fontPromises[font.cacheKey] = loadFont(event, font).then(async (_font) => {
          if (_font?.data)
            await fontCache.setItemRaw(_font.cacheKey, _font.data)
          return _font
        })
      }
      localFontPromises.push(fontPromises[font.cacheKey])
    }
  }
  const awaitedFonts = await Promise.all(localFontPromises)
  return [...preloadedFonts, ...awaitedFonts].map((_f) => {
    // weight must be a number
    return { name: _f.name, data: _f.data, style: _f.style, weight: Number(_f.weight) as SatoriOptions['fonts'][number]['weight'] }
  })
}

export async function createSvg(event: OgImageRenderEventContext) {
  const { options } = event
  const { satoriOptions: _satoriOptions } = useOgImageRuntimeConfig()
  // perform operations async
  const [satori, vnodes, fonts] = await Promise.all([
    useSatori(),
    createVNodes(event),
    resolveFonts(event),
  ])

  await event._nitro.hooks.callHook('nuxt-og-image:satori:vnodes', vnodes, event)
  const satoriOptions: SatoriOptions = defu(options.satori, _satoriOptions, <SatoriOptions> {
    fonts,
    tailwindConfig: { theme },
    embedFont: true,
    width: options.width!,
    height: options.height!,
  }) as SatoriOptions
  return satori(vnodes, satoriOptions)
}

async function createPng(event: OgImageRenderEventContext) {
  const { resvgOptions } = useOgImageRuntimeConfig()
  const svg = await createSvg(event)
  const Resvg = await useResvg()
  const resvg = new Resvg(svg, defu(
    event.options.resvg,
    resvgOptions,
  ))
  const pngData = resvg.render()
  return pngData.asPng()
}

async function createJpeg(event: OgImageRenderEventContext) {
  const { sharpOptions } = useOgImageRuntimeConfig()
  const png = await createPng(event)
  const sharp = await useSharp()
  return sharp(png, defu(event.options.sharp, sharpOptions)).jpeg().toBuffer()
}

const SatoriRenderer: Renderer = {
  name: 'satori',
  supportedFormats: ['png', 'jpeg', 'jpg', 'json'],
  async createImage(e) {
    switch (e.extension) {
      case 'png':
        return createPng(e)
      case 'jpeg':
      case 'jpg':
        return createJpeg(e)
    }
  },
  async debug(e) {
    return {
      vnodes: await createVNodes(e),
      svg: await createSvg(e),
    }
  },
}

export default SatoriRenderer
