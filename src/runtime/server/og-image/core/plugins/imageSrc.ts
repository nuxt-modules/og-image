import type { OgImageRenderEventContext, VNode } from '../../../../types'
import { getNitroOrigin } from '#site-config/server/composables/getNitroOrigin'
import { useStorage } from 'nitropack/runtime'
import { withBase, withoutLeadingSlash } from 'ufo'
import { toBase64Image } from '../../../../shared'
import { decodeHtml } from '../../../util/encoding'
import { logger } from '../../../util/logger'
import { getImageDimensions } from '../../utils/image-detector'
import { defineTransformer } from '../plugins'

// SSRF prevention: block private/loopback URLs outside dev mode
const RE_IPV6_BRACKETS = /^\[|\]$/g
const RE_MAPPED_V4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/
const RE_DIGIT_ONLY = /^\d+$/
const RE_INT_IP = /^(?:0x[\da-f]+|\d+)$/i

function isPrivateIPv4(a: number, b: number): boolean {
  if (a === 127)
    return true // loopback
  if (a === 10)
    return true // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31)
    return true // 172.16.0.0/12
  if (a === 192 && b === 168)
    return true // 192.168.0.0/16
  if (a === 169 && b === 254)
    return true // link-local
  if (a === 0)
    return true // 0.0.0.0/8
  return false
}

/**
 * Block URLs targeting internal/private networks.
 * Handles standard IPs, hex (0x7f000001), decimal (2130706433),
 * IPv6-mapped IPv4 (::ffff:127.0.0.1), and localhost.
 * Only http/https protocols are allowed.
 */
function isBlockedUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return true
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    return true
  const hostname = parsed.hostname.toLowerCase()
  const bare = hostname.replace(RE_IPV6_BRACKETS, '')
  if (bare === 'localhost' || bare.endsWith('.localhost'))
    return true
  // Normalize IPv6-mapped IPv4 (::ffff:1.2.3.4)
  const mappedV4 = bare.match(RE_MAPPED_V4)
  const ip = mappedV4 ? mappedV4[1]! : bare
  // Standard dotted-decimal IPv4
  const parts = ip.split('.')
  if (parts.length === 4 && parts.every(p => RE_DIGIT_ONLY.test(p))) {
    const octets = parts.map(Number)
    if (octets.some(o => o > 255))
      return true
    return isPrivateIPv4(octets[0]!, octets[1]!)
  }
  // Single integer (decimal/hex) IP: e.g. 2130706433 or 0x7f000001
  if (RE_INT_IP.test(ip)) {
    const num = Number(ip)
    if (!Number.isNaN(num) && num >= 0 && num <= 0xFFFFFFFF)
      return isPrivateIPv4((num >> 24) & 0xFF, (num >> 16) & 0xFF)
  }
  // IPv6 private ranges
  if (bare === '::1' || bare.startsWith('fc') || bare.startsWith('fd') || bare.startsWith('fe80'))
    return true
  return false
}

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
        // Block private/loopback URLs outside dev to prevent SSRF
        if (!import.meta.dev && isBlockedUrl(src)) {
          logger.warn(`Blocked internal image fetch: ${src}`)
          delete node.props.src
        }
        else {
          node.props.src = src
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
        if (!import.meta.dev && isBlockedUrl(decodedSrc)) {
          logger.warn(`Blocked internal background-image fetch: ${decodedSrc}`)
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
