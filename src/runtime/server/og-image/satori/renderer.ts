import type { SatoriOptions } from 'satori'
import type { JpegOptions } from 'sharp'
import type { OgImageRenderEventContext, Renderer, ResolvedFontConfig } from '../../../types'
import { fontCache } from '#og-image-cache'
import { tw4FontVars } from '#og-image-virtual/tw4-theme.mjs'
import compatibility from '#og-image/compatibility'
import { defu } from 'defu'
import { sendError } from 'h3'
import { useOgImageRuntimeConfig } from '../../utils'
import { loadAllFonts } from '../fonts'
import { useResvg, useSatori, useSharp } from './instances'
import { createVNodes } from './vnodes'

export async function createSvg(event: OgImageRenderEventContext) {
  const { options } = event
  const { satoriOptions: _satoriOptions } = useOgImageRuntimeConfig()
  const [satori, vnodes, fonts] = await Promise.all([
    useSatori(),
    createVNodes(event),
    loadAllFonts(event.e, { supportsWoff2: false }),
  ])

  await event._nitro.hooks.callHook('nuxt-og-image:satori:vnodes', vnodes, event)
  // Build tailwind theme from TW4 font vars
  const fontFamily: Record<string, string> = {}
  if (tw4FontVars['font-sans'])
    fontFamily.sans = tw4FontVars['font-sans']
  if (tw4FontVars['font-serif'])
    fontFamily.serif = tw4FontVars['font-serif']
  if (tw4FontVars['font-mono'])
    fontFamily.mono = tw4FontVars['font-mono']
  const satoriOptions: SatoriOptions = defu(options.satori, _satoriOptions, <SatoriOptions>{
    fonts,
    tailwindConfig: Object.keys(fontFamily).length ? { theme: { fontFamily } } : undefined,
    embedFont: true,
    width: options.width!,
    height: options.height!,
  }) as SatoriOptions
  return satori(vnodes, satoriOptions).catch((err) => {
    return sendError(event.e, err, true)
  })
}

async function createPng(event: OgImageRenderEventContext) {
  const { resvgOptions } = useOgImageRuntimeConfig()
  const svg = await createSvg(event)
  if (!svg)
    throw new Error('Failed to create SVG')
  const options = defu(event.options.resvg, resvgOptions)
  const Resvg = await useResvg()
  const resvg = new Resvg(svg, options)
  const pngData = resvg.render()
  return pngData.asPng()
}

async function createJpeg(event: OgImageRenderEventContext) {
  const { sharpOptions } = useOgImageRuntimeConfig()
  if (compatibility.sharp === false) {
    throw new Error('Sharp dependency is not accessible. Please check you have it installed and are using a compatible runtime.')
  }
  const svg = await createSvg(event)
  if (!svg) {
    throw new Error('Failed to create SVG for JPEG rendering.')
  }
  const svgBuffer = Buffer.from(svg)
  const sharp = await useSharp().catch(() => {
    throw new Error('Sharp dependency could not be loaded. Please check you have it installed and are using a compatible runtime.')
  })
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
