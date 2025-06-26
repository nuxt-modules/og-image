import type { SatoriOptions } from 'satori'
import type { JpegOptions } from 'sharp'
import type { OgImageRenderEventContext, Renderer, ResolvedFontConfig } from '../../../types'
import { fontCache } from '#og-image-cache'
import { theme } from '#og-image-virtual/unocss-config.mjs'
// @ts-expect-error untyped
import compatibility from '#og-image/compatibility'
import { defu } from 'defu'
import { sendError } from 'h3'
import { normaliseFontInput } from '../../../shared'
import { useOgImageRuntimeConfig } from '../../utils'
import { loadFont } from './font'
import { useResvg, useSatori, useSharp } from './instances'
import { createVNodes } from './vnodes'

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
        localFontPromises.push(fontPromises[font.cacheKey])
      }
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
  return satori(vnodes, satoriOptions).catch((err) => {
    return sendError(event.e, err, import.meta.dev)
  })
}

async function createPng(event: OgImageRenderEventContext) {
  const { resvgOptions } = useOgImageRuntimeConfig()
  const svg = await createSvg(event)
  if (!svg)
    throw new Error('Failed to create SVG')
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
  if (compatibility.sharp === false) {
    if (import.meta.dev) {
      throw new Error('Sharp dependency is not accessible. Please check you have it installed and are using a compatible runtime.')
    }
    else {
      // TODO this should be an error in next major
      console.error('Sharp dependency is not accessible. Please check you have it installed and are using a compatible runtime. Falling back to png.')
    }
    return createPng(event)
  }
  const svg = await createSvg(event)
  if (!svg) {
    throw new Error('Failed to create SVG for JPEG rendering.')
  }
  const svgBuffer = Buffer.from(svg)
  const sharp = await useSharp().catch(() => {
    if (import.meta.dev) {
      throw new Error('Sharp dependency could not be loaded. Please check you have it installed and are using a compatible runtime.')
    }
    return null
  })
  if (!sharp) {
    // TODO this should be an error in next major
    console.error('Sharp dependency is not accessible. Please check you have it installed and are using a compatible runtime. Falling back to png.')
    return createPng(event)
  }
  const options = defu(event.options.sharp, sharpOptions)
  return sharp(svgBuffer, options)
    .jpeg(options as JpegOptions)
    .toBuffer()
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
    const [vnodes, svg] = await Promise.all([
      createVNodes(e),
      createSvg(e),
    ])
    return {
      vnodes,
      svg,
    }
  },
}

export default SatoriRenderer
