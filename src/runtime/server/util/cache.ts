import type { H3Error } from 'h3'
import type { OgImageRenderEventContext } from '../../types'
import { fnv1a64Base36 } from 'fnv1a-64'
import { createError, getQuery, handleCacheHeaders, setHeader, setHeaders } from 'h3'
import { useStorage } from 'nitropack/runtime'
import { withTrailingSlash } from 'ufo'
import { prefixStorage } from 'unstorage'
import { logger } from '../../logger'

/**
 * Constant-time string comparison to prevent timing attacks on secret values.
 * Works on edge runtimes without node:crypto.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length)
    return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++)
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

declare module 'nitropack/types' {
  interface NitroApp {
    _ogImageCacheBackendWarned?: boolean
  }
}

/**
 * Emit a single warning per Nitro app when the cache backend is unreachable.
 * Throttled via a flag stashed on the Nitro app so a broken binding doesn't
 * spam the logs on every request.
 */
function warnCacheBackendUnreachable(ctx: OgImageRenderEventContext, baseCacheKey: string | false, e: unknown): void {
  if (ctx._nitro._ogImageCacheBackendWarned)
    return
  ctx._nitro._ogImageCacheBackendWarned = true
  logger.warn(`[Nuxt OG Image] Cache backend "${baseCacheKey}" unreachable, continuing without cache: ${(e as Error)?.message || e}`)
}

// TODO replace once https://github.com/unjs/nitro/pull/1969 is merged
export async function useOgImageBufferCache(ctx: OgImageRenderEventContext, options: {
  baseCacheKey: string | false
  cacheMaxAgeSeconds?: number
  secret?: string
}): Promise<void | H3Error | { cachedItem: false | BufferSource, enabled: boolean, update: (image: BufferSource | Buffer | Uint8Array) => Promise<void> }> {
  const maxAge = Number(options.cacheMaxAgeSeconds)
  // Skip the runtime buffer cache during prerender. The output is written to a static
  // file served via the `/_og/s/**` route rule (which sets its own immutable caching),
  // and the configured backend may not exist in the Node build environment — e.g. a
  // Cloudflare KV binding is only bound at runtime in the Worker, not during prerender (#613).
  const intentionallyEnabled = !import.meta.dev && !import.meta.prerender && maxAge > 0
  let enabled = intentionallyEnabled
  const cache = prefixStorage(useStorage(), withTrailingSlash(options.baseCacheKey || '/'))
  const key = ctx.key

  // cache will invalidate if the options change
  let cachedItem: BufferSource | false = false
  if (enabled) {
    const hasItem = await cache.hasItem(key).catch((e) => {
      // Backend unreachable (e.g. NuxtHub KV binding missing during Node prerender).
      // Degrade to no-cache for this request rather than failing the render.
      enabled = false
      warnCacheBackendUnreachable(ctx, options.baseCacheKey, e)
      return false
    })
    // `hasItem` succeeding doesn't guarantee `getItem` will: the backend can become
    // unreachable between the two calls, or the stored record can be unreadable.
    // Degrade the same way rather than reporting it as an ordinary cache miss.
    const entry = hasItem
      ? await cache.getItem(key).catch((e) => {
        enabled = false
        warnCacheBackendUnreachable(ctx, options.baseCacheKey, e)
        return null
      }) as any
      : null
    if (entry) {
      const { value, expiresAt, headers } = entry
      const purgeValue = getQuery(ctx.e).purge
      if (typeof purgeValue !== 'undefined') {
        // When URL signing is enabled, require the secret as the purge value
        if (options.secret && !safeCompare(String(purgeValue), options.secret)) {
          return createError({
            statusCode: 403,
            statusMessage: '[Nuxt OG Image] Invalid purge token. Provide the signing secret as ?purge=<secret>.',
          })
        }
        await cache.removeItem(key).catch((err) => {
          // Cache purge should not fail the request if the backend already removed the item.
          void err
        })
      }
      else if (expiresAt > Date.now()) {
        cachedItem = Buffer.from(value, 'base64')
        // Check for cache headers
        if (
          handleCacheHeaders(ctx.e, {
            modifiedTime: new Date(headers['last-modified'] as string),
            etag: headers.etag as string,
            maxAge,
          })
        ) {
          return
        }

        setHeaders(ctx.e, headers)
        setHeader(ctx.e, 'X-OG-Cache', 'HIT')
      }
      else {
        // expired
        await cache.removeItem(key).catch((err) => {
          // Expired cache cleanup is best-effort.
          void err
        })
      }
    }
  }
  if (!enabled && !import.meta.prerender) {
    // add http headers so the file isn't cached — but not during prerender, where the
    // static output is meant to be cached and its headers come from the route rule.
    setHeader(ctx.e, 'Cache-Control', 'no-cache, no-store, must-revalidate')
    setHeader(ctx.e, 'Pragma', 'no-cache')
    setHeader(ctx.e, 'Expires', '0')
  }
  return {
    enabled,
    cachedItem,
    async update(item) {
      // `enabled` is false when caching is off OR the backend degraded mid-request;
      // either way this isn't a normal miss that will be written back.
      setHeader(ctx.e, 'X-OG-Cache', enabled ? 'MISS' : 'DISABLED')
      if (!enabled)
        return
      const value = Buffer.from(item as Uint8Array).toString('base64')
      const headers = {
        // avoid multi-tenancy cache issues
        'Vary': 'accept-encoding, host',
        'etag': `W/"${fnv1a64Base36(value)}"`,
        'last-modified': new Date().toUTCString(),
        'cache-control': `public, max-age=${maxAge}, s-maxage=${maxAge}, immutable`,
      }
      setHeaders(ctx.e, headers)
      await cache.setItem(key, {
        value,
        headers,
        expiresAt: Date.now() + (maxAge * 1000),
      }).catch(err => logger.warn(`[Nuxt OG Image] Failed to write cache for key "${key}": ${err?.message || err}`))
    },
  }
}
