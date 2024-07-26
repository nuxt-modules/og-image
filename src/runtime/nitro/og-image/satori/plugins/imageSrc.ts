import { withBase } from 'ufo'
import sizeOf from 'image-size'
import type { OgImageRenderEventContext, VNode } from '../../../../types'
import { defineSatoriTransformer } from '../utils'
import { toBase64Image } from '../../../../pure'
import { logger } from '../../../util/logger'
import { useNitroOrigin, useStorage } from '#imports'

async function resolveLocalFilePathImage(publicStoragePath: string, src: string) {
  // try hydrating from storage
  // we need to read the file using unstorage
  // because we can't fetch public files using $fetch when prerendering
  const key = `${publicStoragePath}${src.replace('./', ':').replace('/', ':')}`
  if (await useStorage().hasItem(key))
    return await useStorage().getItemRaw(key)
}

// for relative links we embed them as base64 input or just fix the URL to be absolute
export default defineSatoriTransformer([
  // fix <img src="">
  {
    filter: (node: VNode) => node.type === 'img' && node.props?.src,
    transform: async (node: VNode, { e, publicStoragePath }: OgImageRenderEventContext) => {
      const src = node.props.src!
      const isRelative = src.startsWith('/')
      let dimensions
      let imageBuffer: BufferSource | undefined

      if (src.endsWith('.webp')) {
        logger.warn('Using WebP images with Satori is not supported. Please consider switching image format or use the chromium renderer.', src)
      }

      if (isRelative) {
        if (import.meta.prerender || import.meta.dev) {
          // try hydrating from storage
          // we need to read the file using unstorage
          // because we can't fetch public files using $fetch when prerendering
          imageBuffer = await resolveLocalFilePathImage(publicStoragePath, src)
        }
        else {
          // see if we can fetch it from a kv host if we're using an edge provider
          imageBuffer = (await e.$fetch(src, {
            baseURL: useNitroOrigin(e),
            responseType: 'arrayBuffer',
          })
            .catch(() => {})) as BufferSource | undefined
        }
        // convert relative images to base64 as satori will have no chance of resolving
        if (imageBuffer)
          node.props.src = toBase64Image(imageBuffer)
      }
      // avoid trying to fetch base64 image uris
      else if (!src.startsWith('data:')) {
        // see if we can fetch it from a kv host if we're using an edge provider
        imageBuffer = (await $fetch(src, {
          responseType: 'arrayBuffer',
        })
          .catch(() => {})) as BufferSource | undefined
      }

      // if we're missing either a height or width on an image we can try and compute it using the image size
      if (imageBuffer && (!node.props.width || !node.props.height)) {
        try {
          const imageSize = sizeOf(imageBuffer)
          dimensions = { width: imageSize.width, height: imageSize.height }
        }
        catch (e) {
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
      }
      // if it's still relative, we need to swap out the src for an absolute URL
      if (typeof node.props.src === 'string' && node.props.src.startsWith('/')) {
        if (imageBuffer) {
          node.props.src = toBase64Image(imageBuffer)
        }
        else {
          // with query to avoid satori caching issue
          node.props.src = `${withBase(src, `${useNitroOrigin(e)}`)}?${Date.now()}`
        }
      }
    },
  },
  // fix style="background-image: url('')"
  {
    filter: (node: VNode) => node.props?.style?.backgroundImage?.includes('url('),
    transform: async (node: VNode, { e, publicStoragePath }: OgImageRenderEventContext) => {
      // same as the above, need to swap out relative background images for absolute
      const backgroundImage = node.props.style!.backgroundImage!
      const src = backgroundImage.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '')
      const isRelative = src?.startsWith('/')
      if (isRelative) {
        if (import.meta.prerender || import.meta.dev) {
          const imageBuffer = await resolveLocalFilePathImage(publicStoragePath, src)
          if (imageBuffer) {
            const base64 = toBase64Image(Buffer.from(imageBuffer as ArrayBuffer))
            node.props.style!.backgroundImage = `url(${base64})`
          }
        }
        else {
          node.props.style!.backgroundImage = `url(${withBase(src, `${useNitroOrigin(e)}`)}?${Date.now()})`
        }
      }
    },
  },
])
