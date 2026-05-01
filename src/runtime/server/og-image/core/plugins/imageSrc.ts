import type { H3Event } from 'h3'
import type { OgImageRenderEventContext, VNode } from '../../../../types'
import { useStorage } from 'nitropack/runtime'
import { withBase, withoutLeadingSlash } from 'ufo'
import { getNitroOrigin } from '#site-config/server/composables/getNitroOrigin'
import { toBase64Image } from '../../../../shared'
import { decodeHtml } from '../../../util/encoding'
import { fetchLocalAsset } from '../../../util/fetchLocalAsset'
import { getFetchTimeout } from '../../../util/fetchTimeout'
import { logger } from '../../../util/logger'
import { fetchWithRedirectValidation, isBlockedUrl } from '../../../util/ssrf'
import { getImageDimensions } from '../../utils/image-detector'
import { defineTransformer } from '../plugins'

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
      const ab = await timings.measure('image-fetch', () => fetchLocalAsset(e, src, {
        fetchTimeout,
        headers: SUBREQUEST_HEADERS,
        includeExternalFallback: true,
        onStepFailure: logFailure,
      }))
      if (ab)
        buffer = new Uint8Array(ab)
    }
    return buffer ? { buffer } : {}
  }

  const decodedSrc = decodeHtml(src)
  if (!import.meta.dev && isBlockedUrl(decodedSrc)) {
    logger.warn(`Blocked internal ${kind} fetch: ${decodedSrc}`)
    return { blocked: true }
  }
  const end = timings.start('image-fetch')
  // In dev we keep ofetch's default redirect-follow behaviour so loopback /
  // proxy setups work. Outside dev, redirects are followed manually with
  // host re-validation on every hop to close the redirect-bypass class.
  let buffer: BufferSource | undefined
  if (import.meta.dev) {
    buffer = (await $fetch(decodedSrc, {
      responseType: 'arrayBuffer',
      timeout: fetchTimeout,
    }).catch((err) => {
      logFailure(decodedSrc, err)
    }).finally(end)) as BufferSource | undefined
  }
  else {
    const ab = await fetchWithRedirectValidation(decodedSrc, {
      timeout: fetchTimeout,
    }).catch((err) => {
      logFailure(decodedSrc, err)
      return null
    }).finally(end)
    if (ab)
      buffer = new Uint8Array(ab)
  }
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
      // satori/takumi may attempt to resolve at render time (against the app's
      // own origin, not an attacker-controlled one)
      if (isRelative) {
        node.props.src = withBase(src, `${getNitroOrigin(ctx.e)}`)
        return
      }
      // Absolute external URL whose validated fetch failed. Drop it in
      // production: letting it survive would invite the renderer (satori
      // fetches <img> URLs internally; takumi fetches via extractResourceUrls)
      // to re-issue the request without SSRF/redirect validation.
      if (!import.meta.dev)
        delete node.props.src
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
      if (result.buffer) {
        node.props.style!.backgroundImage = `url(${toBufferSourceAsBase64(result.buffer)})`
        return
      }
      // Same reasoning as the <img> branch: an absolute external URL that
      // didn't inline must not be left for the renderer to fetch unvalidated.
      if (!import.meta.dev && !src.startsWith('/'))
        delete node.props.style!.backgroundImage
    },
  },
])
