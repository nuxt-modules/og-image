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
    filter: (node: VNode) => node.type === 'img',
    transform: async (node: VNode, { e }: OgImageRenderEventContext) => {
      const src = node.props?.src as string | null
      const isRelative = src?.startsWith('/')
      if (src) {
        let updated = false
        let dimensions
        let imageBuffer: BufferSource
        let valid = true

        // we can't fetch public files using $fetch when prerendering
        if (import.meta.prerender || import.meta.dev) {
          // we need to read the file using unstorage
          const key = `root:public${src.replace('./', ':').replace('/', ':')}`
          if (await useStorage().hasItem(key)) {
            imageBuffer = await useStorage().getItemRaw(key)
            updated = !!imageBuffer
          }
        }
        if (!import.meta.prerender && !updated) {
          // see if we can fetch it from a kv host if we're using an edge provider
          imageBuffer = (await e.$fetch(src, {
            baseURL: useNitroOrigin(e),
            responseType: 'arrayBuffer',
          })
            .catch(() => {
              valid = false
            }))
          valid = !!imageBuffer
        }
        if (valid) {
          node.props.src = toBase64Image(src, imageBuffer as ArrayBuffer)

          try {
            const imageSize = sizeOf(Buffer.from(imageBuffer as ArrayBuffer))
            dimensions = { width: imageSize.width, height: imageSize.height }
          }
          catch (e) {}
          updated = true
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
        if (!updated && isRelative) {
          // with query to avoid satori caching issue
          node.props.src = `${withBase(src, `${useNitroOrigin(e)}`)}?${Date.now()}`
        }
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
