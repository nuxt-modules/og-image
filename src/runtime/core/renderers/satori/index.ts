import type { H3Event } from 'h3'
import type { SatoriOptions } from 'satori'
import { defu } from 'defu'
import type { Renderer, RendererOptions } from '../../../types'
import { createVNodes } from './vnodes'
import { loadFonts, satoriFonts } from './fonts'
import { useResvg, useSatori, useSharp } from './instances'
import { useRuntimeConfig } from '#imports'

export async function createSvg(e: H3Event, options: RendererOptions) {
  const { fonts, satoriOptions } = useRuntimeConfig()['nuxt-og-image']
  const vnodes = await createVNodes(e, options)

  if (!satoriFonts.length)
    satoriFonts.push(...await loadFonts(e, fonts))

  const satori = await useSatori()
  return satori(vnodes, <SatoriOptions> defu(options.satori, satoriOptions, {
    fonts: satoriFonts,
    embedFont: true,
    width: options.width!,
    height: options.height!,
  }))
}

async function createPng(e: H3Event, options: RendererOptions) {
  const { resvgOptions } = useRuntimeConfig()['nuxt-og-image']
  const svg = await createSvg(e, options)
  const Resvg = await useResvg()
  const resvg = new Resvg(svg, defu(
    options.resvg,
    resvgOptions,
  ))
  const pngData = resvg.render()
  return pngData.asPng()
}

async function createJpeg(e: H3Event, options: RendererOptions) {
  const { sharpOptions } = useRuntimeConfig()['nuxt-og-image']
  const png = await createPng(e, options)
  const sharp = await useSharp()
  return sharp(png, defu(options.sharp, sharpOptions)).jpeg(defu(options.sharp, sharpOptions)).toBuffer()
}

const SatoriRenderer: Renderer = {
  name: 'satori',
  supportedFormats: ['svg', 'png', 'jpeg', 'jpg', 'json'],
  async createImage(e, options) {
    switch (options.extension) {
      case 'json':
        return createVNodes(e, options)
      case 'svg':
        return createSvg(e, options)
      case 'png':
        return createPng(e, options)
      case 'jpeg':
      case 'jpg':
        return createJpeg(e, options)
    }
  },
}

export default SatoriRenderer
