import type { OgImageRenderEventContext, VNode } from '../../../../types'
import { getNitroOrigin } from '#site-config/server/composables/getNitroOrigin'
import { getSiteConfig } from '#site-config/server/composables/getSiteConfig'
import { useStorage } from 'nitropack/runtime'
import { withBase, withoutLeadingSlash } from 'ufo'
import { toBase64Image } from '../../../../shared'
import { decodeHtml } from '../../../util/encoding'
import { logger } from '../../../util/logger'
import { validateExternalUrl } from '../../../util/security'
import { getImageDimensions } from '../../utils/image-detector'
import { defineTransformer } from '../plugins'

const RE_URL_LEADING = /^url\(['"]?/
const RE_URL_TRAILING = /['"]?\)$/

async function resolveLocalFilePathImage(publicStoragePath: string, src: string) {
  // try hydrating from storage
  // we need to read the file using unstorage
  // because we can't fetch public files using $fetch when prerendering
  const normalizedSrc = withoutLeadingSlash(src
    .replace('_nuxt/@fs/', '')
    .replace('_nuxt/', '')
    .replace('./', ''),
  ).replaceAll('/', ':')
  const key = `${publicStoragePath}:${normalizedSrc}`
  if (await useStorage().hasItem(key))
    return await useStorage().getItemRaw(key)
}

// for relative links we embed them as base64 input or just fix the URL to be absolute
export default defineTransformer([
  // fix <img src="">
  {
    filter: (node: VNode) => node.type === 'img' && node.props?.src,
    transform: async (node: VNode, { e, publicStoragePath, runtimeConfig }: OgImageRenderEventContext) => {
      let src: string = node.props.src!
      const isRelative = src.startsWith('/')
      let dimensions
      let imageBuffer: BufferSource | undefined

      if (src.endsWith('.webp')) {
        logger.warn('Using WebP images with Satori is not supported. Please consider switching image format or use the chromium renderer.', src)
      }

      if (isRelative) {
        if (import.meta.prerender || import.meta.dev) {
          const srcWithoutBase = src.replace(runtimeConfig.app.baseURL, '')
          // try hydrating from storage
          // we need to read the file using unstorage
          // because we can't fetch public files using $fetch when prerendering
          imageBuffer = await resolveLocalFilePathImage(publicStoragePath, srcWithoutBase)
        }
        if (!imageBuffer) {
          // see if we can fetch it from a kv host if we're using an edge provider
          imageBuffer = (await e.$fetch(src, { responseType: 'arrayBuffer' })
            .catch(() => {})) as BufferSource | undefined
          if (!imageBuffer && !import.meta.prerender) {
            // see if we can fetch it from a kv host if we're using an edge provider
            imageBuffer = (await e.$fetch(src, {
              baseURL: getNitroOrigin(e),
              responseType: 'arrayBuffer',
            })
              .catch(() => {})) as BufferSource | undefined
          }
        }
        // convert relative images to base64 as satori will have no chance of resolving
        if (imageBuffer) {
          const buffer = imageBuffer instanceof ArrayBuffer ? imageBuffer : imageBuffer.buffer as ArrayBuffer
          node.props.src = toBase64Image(buffer)
        }
      }
      // avoid trying to fetch base64 image uris
      else if (!src.startsWith('data:')) {
        src = decodeHtml(src)
        node.props.src = src
        const siteUrl = getSiteConfig(e).url
        if (!validateExternalUrl(src, siteUrl)) {
          logger.warn(`Blocked external image fetch (not same-origin): ${src}`)
        }
        else {
          // fetch remote images and embed as base64 to avoid satori re-fetching at render time
          imageBuffer = (await $fetch(src, {
            responseType: 'arrayBuffer',
          })
            .catch(() => {})) as BufferSource | undefined
          if (imageBuffer) {
            const buffer = imageBuffer instanceof ArrayBuffer ? imageBuffer : imageBuffer.buffer as ArrayBuffer
            node.props.src = toBase64Image(buffer)
          }
        }
      }

      // convert string dimensions to numbers for Satori
      if (typeof node.props.width === 'string')
        node.props.width = Number(node.props.width) || undefined
      if (typeof node.props.height === 'string')
        node.props.height = Number(node.props.height) || undefined

      // if we're missing either a height or width on an image we can try and compute it using the image size
      if (imageBuffer && (!node.props.width || !node.props.height)) {
        dimensions = getImageDimensions(imageBuffer as Uint8Array)
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
          const buffer = imageBuffer instanceof ArrayBuffer ? imageBuffer : imageBuffer.buffer as ArrayBuffer
          node.props.src = toBase64Image(buffer)
        }
        else {
          // with query to avoid satori caching issue
          node.props.src = `${withBase(src, `${getNitroOrigin(e)}`)}?${Date.now()}`
        }
      }
    },
  },
  // fix style="background-image: url('')"
  {
    filter: (node: VNode) => node.props?.style?.backgroundImage?.includes('url('),
    transform: async (node: VNode, { e, publicStoragePath, runtimeConfig }: OgImageRenderEventContext) => {
      // same as the above, need to swap out relative background images for absolute
      const backgroundImage = node.props.style!.backgroundImage!
      const src = backgroundImage.replace(RE_URL_LEADING, '').replace(RE_URL_TRAILING, '')
      if (src.startsWith('data:'))
        return
      const isRelative = src?.startsWith('/')
      let imageBuffer: BufferSource | undefined
      if (isRelative) {
        if (import.meta.prerender || import.meta.dev) {
          const srcWithoutBase = src.replace(runtimeConfig.app.baseURL, '/')
          imageBuffer = await resolveLocalFilePathImage(publicStoragePath, srcWithoutBase)
        }
        if (!imageBuffer) {
          imageBuffer = (await e.$fetch(src, { responseType: 'arrayBuffer' })
            .catch(() => {})) as BufferSource | undefined
          if (!imageBuffer && !import.meta.prerender) {
            imageBuffer = (await e.$fetch(src, {
              baseURL: getNitroOrigin(e),
              responseType: 'arrayBuffer',
            }).catch(() => {})) as BufferSource | undefined
          }
        }
      }
      else {
        const decodedSrc = decodeHtml(src)
        const siteUrl = getSiteConfig(e).url
        if (!validateExternalUrl(decodedSrc, siteUrl)) {
          logger.warn(`Blocked external background-image fetch (not same-origin): ${decodedSrc}`)
        }
        else {
          imageBuffer = (await $fetch(decodedSrc, {
            responseType: 'arrayBuffer',
          }).catch(() => {})) as BufferSource | undefined
        }
      }
      if (imageBuffer) {
        const buffer = imageBuffer instanceof ArrayBuffer ? imageBuffer : imageBuffer.buffer as ArrayBuffer
        node.props.style!.backgroundImage = `url(${toBase64Image(buffer)})`
      }
    },
  },
])
