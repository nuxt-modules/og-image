import { Buffer } from 'node:buffer'
import { withBase } from 'ufo'
import sizeOf from 'image-size'
import type { OgImageRenderEventContext, VNode } from '../../../../types'
import { defineSatoriTransformer } from '../utils'
import { toBase64Image } from '../../../env/assets'
import { useStorage } from '#internal/nitro'
import { useNitroOrigin } from '#imports'

// for relative links we embed them as base64 input or just fix the URL to be absolute
export default defineSatoriTransformer([
  // fix <img src="">
  {
    filter: (node: VNode) => node.type === 'img' && node.props?.src,
    transform: async (node: VNode, { e }: OgImageRenderEventContext) => {
      const src = node.props.src!
      const isRelative = src.startsWith('/')
      let dimensions
      let imageBuffer: BufferSource | undefined

      if (isRelative) {
        if (import.meta.prerender || import.meta.dev) {
          // try hydrating from storage
          // we need to read the file using unstorage
          // because we can't fetch public files using $fetch when prerendering
          const key = `root:public${src.replace('./', ':').replace('/', ':')}`
          if (await useStorage().hasItem(key))
            imageBuffer = await useStorage().getItemRaw(key)
        }
        else {
          // see if we can fetch it from a kv host if we're using an edge provider
          imageBuffer = (await e.$fetch(src, {
            baseURL: useNitroOrigin(e),
            responseType: 'arrayBuffer',
          })
            .catch(() => {})) as BufferSource | undefined
        }
      }
      else {
        // see if we can fetch it from a kv host if we're using an edge provider
        imageBuffer = (await $fetch(src, {
          responseType: 'arrayBuffer',
        })
          .catch(() => {})) as BufferSource | undefined
      }
      if (imageBuffer)
        imageBuffer = Buffer.from(imageBuffer as ArrayBuffer)
      if (imageBuffer) {
        node.props.src = toBase64Image(src, imageBuffer)

        try {
          const imageSize = sizeOf(imageBuffer)
          dimensions = { width: imageSize.width, height: imageSize.height }
        }
        catch (e) {}
      }
      // apply a natural aspect ratio if missing a dimension
      if (dimensions?.width && dimensions?.height) {
        const naturalAspectRatio = dimensions.width / dimensions.height
        if (node.props.width && !node.props.height) {
          node.props.height = Math.round(node.props.width / naturalAspectRatio)
        }
        else if (node.props.height && !node.props.width) {
          node.props.width = Math.round(node.props.height * naturalAspectRatio)
        }
        else if (!node.props.width && !node.props.height) {
          node.props.width = dimensions.width
          node.props.height = dimensions.height
        }
      }
      // if it's still relative, we need to swap out the src for an absolute URL
      if (node.props.src.startsWith('/')) {
        // with query to avoid satori caching issue
        node.props.src = `${withBase(src, `${useNitroOrigin(e)}`)}?${Date.now()}`
      }
    },
  },
  // fix style="background-image: url('')"
  {
    filter: (node: VNode) => node.props?.style?.backgroundImage?.includes('url('),
    transform: async (node: VNode, { e }: OgImageRenderEventContext) => {
      // same as the above, need to swap out relative background images for absolute
      const backgroundImage = node.props.style!.backgroundImage
      if (backgroundImage) {
        const src = backgroundImage.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '')
        const isRelative = src?.startsWith('/')
        if (isRelative)
          node.props.style!.backgroundImage = `url(${withBase(src, `${useNitroOrigin(e)}`)}?${Date.now()})`
      }
    },
  },
])
