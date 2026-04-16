import type { H3Event } from 'h3'
import type { OgImageRenderEventContext, VNode } from '../../../../types'
import { getNitroOrigin } from '#site-config/server/composables/getNitroOrigin'
import { useStorage } from 'nitropack/runtime'
import { withBase, withoutLeadingSlash } from 'ufo'
import { toBase64Image } from '../../../../shared'
import { tryCloudflareAssetsFetch } from '../../../util/cloudflareAssets'
import { decodeHtml } from '../../../util/encoding'
import { getFetchTimeout } from '../../../util/fetchTimeout'
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

// Marker header lets downstream middleware short-circuit expensive work on
// subrequests we make during OG image rendering (e.g. on CF Workers where a
// logo/asset path may route back through the same worker).
const SUBREQUEST_HEADERS = { 'x-nuxt-og-image': '1' }

async function resolveLocalFilePathImage(publicStoragePath: string, src: string) {
  // try hydrating from storage — can't fetch public files via $fetch when prerendering
  const normalizedSrc = withoutLeadingSlash(src
    .replace('_nuxt/@fs/', '')
    .replace('_nuxt/', '')
    .replace('./', ''),
  ).replaceAll('/', ':')
  const key = `${publicStoragePath}:${normalizedSrc}`
  if (await useStorage().hasItem(key))
    return await useStorage().getItemRaw(key)
}

function toBufferSourceAsBase64(buf: BufferSource): string {
  const ab = buf instanceof ArrayBuffer
    ? buf
    : ArrayBuffer.isView(buf)
      ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
      : buf
  return toBase64Image(ab)
}

interface ResolveResult {
  buffer?: BufferSource
  blocked?: boolean
}

// Per-render dedup: the same URL referenced multiple times in a template
// (e.g. logo in header + footer) resolves once. Scoped by H3Event so buffers
// don't leak across renders — entries drop with the event reference.
const renderCaches = new WeakMap<H3Event, Map<string, Promise<ResolveResult>>>()

function getRenderCache(e: H3Event): Map<string, Promise<ResolveResult>> {
  let cache = renderCaches.get(e)
  if (!cache) {
    cache = new Map()
    renderCaches.set(e, cache)
  }
  return cache
}

function resolveSrcToBuffer(
  src: string,
  kind: 'image' | 'background-image',
  ctx: OgImageRenderEventContext,
): Promise<ResolveResult> {
  const cache = getRenderCache(ctx.e)
  const existing = cache.get(src)
  if (existing)
    return existing
  const promise = doResolveSrcToBuffer(src, kind, ctx)
  cache.set(src, promise)
  return promise
}

async function doResolveSrcToBuffer(
  src: string,
  kind: 'image' | 'background-image',
  { e, publicStoragePath, runtimeConfig, timings }: OgImageRenderEventContext,
): Promise<ResolveResult> {
  const fetchTimeout = getFetchTimeout(runtimeConfig)
  const logFailure = (url: string, err: unknown) => {
    logger.debug(`[og-image] ${kind} fetch failed (${url}): ${(err as Error)?.message || err}`)
  }

  if (src.startsWith('/')) {
    let buffer: BufferSource | undefined
    if (import.meta.prerender || import.meta.dev) {
      const srcWithoutBase = src.replace(runtimeConfig.app.baseURL, '/')
      buffer = await resolveLocalFilePathImage(publicStoragePath, srcWithoutBase)
    }
    if (!buffer && !import.meta.prerender) {
      // Shared deadline across the fallback ladder: a broken URL should not
      // burn 3× fetchTimeout before the render sees the failure.
      const deadline = AbortSignal.timeout(fetchTimeout)
      const remaining = () => {
        // rough approximation; ofetch's own timeout also enforces upper bound
        return deadline.aborted ? 1 : fetchTimeout
      }
      const end = timings.start('image-fetch')
      try {
        // CF Workers ASSETS binding: hits the static asset handler directly.
        // No subrequest billed, no middleware re-run. Returns undefined for
        // non-asset paths so Nitro routes still resolve via localFetch below.
        buffer = await tryCloudflareAssetsFetch(e, src, deadline)
          .catch((err) => {
            logFailure(src, err)
            return undefined
          })
        if (!buffer && !deadline.aborted) {
          // Nitro localFetch: resolves dynamic routes (not just static assets).
          buffer = (await e.$fetch(src, {
            responseType: 'arrayBuffer',
            signal: deadline,
            timeout: remaining(),
            headers: SUBREQUEST_HEADERS,
          }).catch((err) => {
            logFailure(src, err)
          })) as BufferSource | undefined
        }
        if (!buffer && !deadline.aborted) {
          // Real external fetch: for platforms where the static asset is served
          // by platform-level routing (Vercel, Netlify edge) and never reaches
          // Nitro. Uses global $fetch (ofetch) for a true HTTP hop.
          const absolute = `${getNitroOrigin(e)}${src}`
          buffer = (await $fetch(absolute, {
            responseType: 'arrayBuffer',
            signal: deadline,
            timeout: remaining(),
            headers: SUBREQUEST_HEADERS,
          }).catch((err) => {
            logFailure(absolute, err)
          })) as BufferSource | undefined
        }
      }
      finally {
        end()
      }
    }
    return buffer ? { buffer } : {}
  }

  const decodedSrc = decodeHtml(src)
  if (!import.meta.dev && isBlockedUrl(decodedSrc)) {
    logger.warn(`Blocked internal ${kind} fetch: ${decodedSrc}`)
    return { blocked: true }
  }
  const end = timings.start('image-fetch')
  const buffer = (await $fetch(decodedSrc, {
    responseType: 'arrayBuffer',
    timeout: fetchTimeout,
  }).catch((err) => {
    logFailure(decodedSrc, err)
  }).finally(end)) as BufferSource | undefined
  return buffer ? { buffer } : {}
}

function applyImageDimensions(node: VNode, buffer: BufferSource) {
  // convert string dimensions to numbers for Satori
  if (typeof node.props.width === 'string')
    node.props.width = Number(node.props.width) || undefined
  if (typeof node.props.height === 'string')
    node.props.height = Number(node.props.height) || undefined

  // infer missing dimensions from the image's natural aspect ratio
  if (node.props.width && node.props.height)
    return
  const view = buffer instanceof Uint8Array
    ? buffer
    : ArrayBuffer.isView(buffer)
      ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : new Uint8Array(buffer)
  const dimensions = getImageDimensions(view)
  if (!dimensions?.width || !dimensions?.height)
    return
  const naturalAspectRatio = dimensions.width / dimensions.height
  if (node.props.width && !node.props.height) {
    node.props.height = Math.round(node.props.width / naturalAspectRatio)
  }
  else if (node.props.height && !node.props.width) {
    node.props.width = Math.round(node.props.height * naturalAspectRatio)
  }
  else {
    node.props.width = dimensions.width
    node.props.height = dimensions.height
  }
}

export default defineTransformer([
  // fix <img src="">
  {
    filter: (node: VNode) => node.type === 'img' && node.props?.src,
    transform: async (node: VNode, ctx: OgImageRenderEventContext) => {
      let src: string = node.props.src!
      if (src.startsWith('data:'))
        return
      if (src.endsWith('.webp')) {
        logger.warn('Using WebP images with Satori is not supported. Please consider switching image format or use the chromium renderer.', src)
      }
      const isRelative = src.startsWith('/')
      if (!isRelative)
        src = node.props.src = decodeHtml(src)

      const result = await resolveSrcToBuffer(src, 'image', ctx)
      if (result.blocked) {
        delete node.props.src
        return
      }
      if (result.buffer) {
        node.props.src = toBufferSourceAsBase64(result.buffer)
        applyImageDimensions(node, result.buffer)
        return
      }
      // relative src couldn't be fetched — fall back to an absolute URL so
      // satori/takumi may attempt to resolve at render time
      if (isRelative)
        node.props.src = withBase(src, `${getNitroOrigin(ctx.e)}`)
    },
  },
  // fix style="background-image: url('')"
  {
    filter: (node: VNode) => node.props?.style?.backgroundImage?.includes('url('),
    transform: async (node: VNode, ctx: OgImageRenderEventContext) => {
      const backgroundImage = node.props.style!.backgroundImage!
      const src = backgroundImage.replace(RE_URL_LEADING, '').replace(RE_URL_TRAILING, '')
      if (src.startsWith('data:'))
        return
      const result = await resolveSrcToBuffer(src, 'background-image', ctx)
      if (result.blocked) {
        delete node.props.style!.backgroundImage
        return
      }
      if (result.buffer)
        node.props.style!.backgroundImage = `url(${toBufferSourceAsBase64(result.buffer)})`
    },
  },
])
