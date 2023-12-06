import type { SatoriOptions } from 'satori'
import { defu } from 'defu'
import type { OgImageRenderEventContext, Renderer } from '../../../types'
import { useOgImageRuntimeConfig } from '../../../utils'
import { createVNodes } from './vnodes'
import { loadFonts, satoriFonts } from './fonts'
import { useResvg, useSatori, useSharp } from './instances'

export async function createSvg(event: OgImageRenderEventContext) {
  const { options } = event
  const { fonts, satoriOptions } = useOgImageRuntimeConfig()
  const vnodes = await createVNodes(event)

  await event._nitro.hooks.callHook('nuxt-og-image:satori:vnodes', vnodes)

  if (!satoriFonts.length)
    satoriFonts.push(...await loadFonts(event, fonts))

  const satori = await useSatori()
  return satori(vnodes, <SatoriOptions> defu(options.satori, satoriOptions, {
    fonts: satoriFonts,
    embedFont: true,
    width: options.width!,
    height: options.height!,
  }))
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
