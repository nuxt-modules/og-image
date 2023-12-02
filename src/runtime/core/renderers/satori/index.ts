import type { SatoriOptions } from 'satori'
import { defu } from 'defu'
import type { H3EventOgImageRender, Renderer } from '../../../types'
import { createVNodes } from './vnodes'
import { loadFonts, satoriFonts } from './fonts'
import { useResvg, useSatori, useSharp } from './instances'
import { useRuntimeConfig } from '#imports'

export async function createSvg(event: H3EventOgImageRender) {
  const { options } = event
  const { fonts, satoriOptions } = useRuntimeConfig()['nuxt-og-image']
  const vnodes = await createVNodes(event)

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

async function createPng(event: H3EventOgImageRender) {
  const { resvgOptions } = useRuntimeConfig()['nuxt-og-image']
  const svg = await createSvg(event)
  const Resvg = await useResvg()
  const resvg = new Resvg(svg, defu(
    event.options.resvg,
    resvgOptions,
  ))
  const pngData = resvg.render()
  return pngData.asPng()
}

async function createJpeg(event: H3EventOgImageRender) {
  const { sharpOptions } = useRuntimeConfig()['nuxt-og-image']
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
