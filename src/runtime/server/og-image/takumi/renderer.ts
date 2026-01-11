import type { OgImageRenderEventContext, Renderer, ResolvedFontConfig } from '../../../types'
import { fontCache } from '#og-image-cache'
import { defu } from 'defu'
import { sendError } from 'h3'
import { loadFont } from '../satori/font'
import { useTakumi } from './instances'
import { createTakumiNodes } from './nodes'

const fontPromises: Record<string, Promise<ResolvedFontConfig>> = {}

async function resolveFonts(event: OgImageRenderEventContext) {
  // get fonts from @nuxt/fonts virtual module
  const fontsModule = await import('#nuxt-og-image/fonts').catch(() => ({ resolvedFonts: [] }))
  const resolvedFonts = fontsModule.resolvedFonts || []

  const fontConfigs: ResolvedFontConfig[] = resolvedFonts.map((f: { family: string, weight: number, style: string }) => ({
    name: f.family,
    weight: f.weight,
    style: (f.style === 'italic' ? 'ital' : 'normal') as 'normal' | 'ital',
    cacheKey: `${f.family}-${f.weight}-${f.style}`,
  }))

  const localFontPromises: Promise<ResolvedFontConfig>[] = []
  const preloadedFonts: ResolvedFontConfig[] = []

  if (fontCache) {
    for (const font of fontConfigs) {
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

  const renderOptions = defu(options.takumi, {
    width: options.width!,
    height: options.height!,
    format,
  })

  return renderer.render(nodes, renderOptions).catch((err: Error) => sendError(event.e, err, import.meta.dev))
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
