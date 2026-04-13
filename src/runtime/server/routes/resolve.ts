import type { H3Event } from 'h3'
import { getSiteConfig } from '#site-config/server/composables/getSiteConfig'
import { createError, defineEventHandler, getQuery, getRequestHost, sendRedirect } from 'h3'
import { parseURL, withLeadingSlash, withQuery } from 'ufo'
import { isInternalRoute } from '../../shared'
import { useOgImageRuntimeConfig } from '../utils'

// Matches a single <meta> tag and captures property/name and content attributes
// regardless of attribute order. Case-insensitive; content may be single or
// double quoted. Attribute values disallow the quote character to avoid
// over-matching across tags.
const RE_META_TAG = /<meta\b[^>]*>/gi
const RE_META_KEY = /\b(?:property|name)\s*=\s*(?:"([^"]+)"|'([^']+)')/i
const RE_META_CONTENT = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i

// Cap the target path length to prevent amplification attacks where a tiny
// request triggers an expensive upstream fetch or fills storage with cache
// entries keyed by pathological URLs.
const MAX_RESOLVE_PATH_LENGTH = 2048

// Strips everything up to and including `/_og/r` so the handler works under
// any baseURL. Preserves the subpath that follows.
const RE_STRIP_PREFIX = /^.*?\/_og\/r/
// Allow `/_og/r/blog/post.png` as an alias for `/_og/r/blog/post` so the URL
// can be used in contexts expecting an image extension.
const RE_IMAGE_EXT = /\.(?:png|jpe?g|webp|svg)$/i
// Matches protocol-relative prefixes (`//evil.com/...`) after leading-slash
// normalisation.
const RE_DOUBLE_LEADING_SLASH = /^\/{2,}/

function extractMeta(html: string, key: string): string | undefined {
  for (const tagMatch of html.matchAll(RE_META_TAG)) {
    const tag = tagMatch[0]
    const keyMatch = tag.match(RE_META_KEY)
    const keyValue = keyMatch?.[1] ?? keyMatch?.[2]
    if (keyValue?.toLowerCase() !== key)
      continue
    const contentMatch = tag.match(RE_META_CONTENT)
    const content = contentMatch?.[1] ?? contentMatch?.[2]
    if (content)
      return content
  }
  return undefined
}

function resolveTargetPath(event: H3Event): string {
  const pathname = parseURL(event.path).pathname
  const stripped = pathname.replace(RE_STRIP_PREFIX, '') || '/'
  // The actual redirect target comes from the page's own og:image declaration,
  // so the trailing image extension is purely cosmetic.
  return stripped.replace(RE_IMAGE_EXT, '') || '/'
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = useOgImageRuntimeConfig()
  const security = runtimeConfig.security

  // Origin restriction: mirror imageEventHandler — block runtime requests from
  // unknown hosts so the resolver can't be abused as an open proxy. Loopback
  // hosts are only trusted when URL signing is active (matches the main
  // handler's policy).
  if (!import.meta.prerender && !import.meta.dev && security?.restrictRuntimeImagesToOrigin) {
    const requestHost = getRequestHost(event, { xForwardedHost: true })
    let requestHostname: string | undefined
    if (requestHost) {
      try {
        requestHostname = new URL(`http://${requestHost}`).hostname
      }
      catch {
        requestHostname = undefined
      }
    }
    const isLoopback = !!security.secret && (
      requestHostname === 'localhost'
      || requestHostname === '127.0.0.1'
      || requestHostname === '::1'
    )
    if (!isLoopback) {
      const siteHost = new URL(getSiteConfig(event).url).host
      const allowedHosts = [siteHost, ...security.restrictRuntimeImagesToOrigin.map((o) => {
        try {
          return new URL(o).host
        }
        catch {
          return o
        }
      })]
      if (!requestHost || !allowedHosts.includes(requestHost)) {
        throw createError({
          statusCode: 403,
          statusMessage: '[Nuxt OG Image] Host not allowed.',
        })
      }
    }
  }

  // Reject oversized query strings to reduce parsing / fetch amplification.
  if (security?.maxQueryParamSize && !import.meta.prerender) {
    const queryString = parseURL(event.path).search || ''
    if (queryString.length > security.maxQueryParamSize) {
      throw createError({
        statusCode: 400,
        statusMessage: `[Nuxt OG Image] Query string exceeds maximum allowed length of ${security.maxQueryParamSize} characters.`,
      })
    }
  }

  const targetPath = resolveTargetPath(event)

  if (targetPath.length > MAX_RESOLVE_PATH_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `[Nuxt OG Image] Target path exceeds ${MAX_RESOLVE_PATH_LENGTH} characters.`,
    })
  }

  // Reject anything that looks like a protocol-relative or absolute URL sneaking
  // past withLeadingSlash (e.g. `/_og/r//evil.com/x`). After withLeadingSlash
  // collapses to a single leading `/`, a benign path starts with `/` followed
  // by a non-slash character.
  if (targetPath.includes('://') || RE_DOUBLE_LEADING_SLASH.test(targetPath)) {
    throw createError({
      statusCode: 400,
      statusMessage: '[Nuxt OG Image] Target path must be a same-origin path.',
    })
  }

  if (isInternalRoute(targetPath)) {
    throw createError({
      statusCode: 400,
      statusMessage: '[Nuxt OG Image] Cannot resolve og:image for internal route.',
    })
  }

  const query = getQuery(event)
  // Pull out resolver-controlled params (prefixed `_og_`) before forwarding the
  // rest to the page fetch, so they don't leak into the rendered page's query.
  const metaKey = query._og_key === 'twitter' ? 'twitter:image' : 'og:image'
  const forwardQuery: Record<string, any> = {}
  for (const [k, v] of Object.entries(query)) {
    if (!k.startsWith('_og_'))
      forwardQuery[k] = v
  }

  const fetchPath = withQuery(withLeadingSlash(targetPath), forwardQuery)

  const html = await event.$fetch<string>(fetchPath, {
    headers: { accept: 'text/html' },
    responseType: 'text',
  }).catch((err: unknown) => {
    throw createError({
      statusCode: 502,
      statusMessage: `[Nuxt OG Image] Failed to fetch ${fetchPath}: ${(err as Error)?.message || 'unknown error'}`,
    })
  })

  const resolved = extractMeta(String(html), metaKey)
  if (!resolved) {
    throw createError({
      statusCode: 404,
      statusMessage: `[Nuxt OG Image] No <meta property="${metaKey}"> found on ${fetchPath}.`,
    })
  }

  return sendRedirect(event, resolved, 302)
})
