import type { OgImageRenderEventContext, Renderer } from '../../../types'
import { defu } from 'defu'
import { sendError } from 'h3'
import { useTakumi } from './instances'
import { createTakumiNodes } from './nodes'

async function resolveFonts(event: OgImageRenderEventContext) {
  return []
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

  await event._nitro.hooks.callHook('nuxt-og-image:takumi:nodes' as any, nodes, event)

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
