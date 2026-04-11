import type { H3Error } from 'h3'
import type { OgImageRenderEventContext } from '../../types'
import { createError, getQuery, handleCacheHeaders, setHeader, setHeaders } from 'h3'
import { useStorage } from 'nitropack/runtime'
import { digest } from 'ohash'
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

// TODO replace once https://github.com/unjs/nitro/pull/1969 is merged
export async function useOgImageBufferCache(ctx: OgImageRenderEventContext, options: {
  baseCacheKey: string | false
  cacheMaxAgeSeconds?: number
  secret?: string
}): Promise<void | H3Error | { cachedItem: false | BufferSource, enabled: boolean, update: (image: BufferSource | Buffer | Uint8Array) => Promise<void> }> {
  const maxAge = Number(options.cacheMaxAgeSeconds)
  const intentionallyEnabled = !import.meta.dev && maxAge > 0
  let enabled = intentionallyEnabled
  const cache = prefixStorage(useStorage(), withTrailingSlash(options.baseCacheKey || '/'))
  const key = ctx.key

  // cache will invalidate if the options change
  let cachedItem: BufferSource | false = false
  if (enabled) {
    const hasItem = await cache.hasItem(key).catch((e) => {
      enabled = false
      return createError({
        cause: e,
        statusCode: 500,
        statusMessage: `[Nuxt OG Image] Failed to connect to cache ${options.baseCacheKey}. Response from cache: ${e.message}`,
      })
    })
    if (hasItem instanceof Error)
      return hasItem
    if (hasItem) {
      const { value, expiresAt, headers } = await cache.getItem(key).catch(() => ({
        value: null,
        expiresAt: Date.now(),
      })) as any
      const purgeValue = getQuery(ctx.e).purge
      if (typeof purgeValue !== 'undefined') {
        // When URL signing is enabled, require the secret as the purge value
        if (options.secret && !safeCompare(String(purgeValue), options.secret)) {
          return createError({
            statusCode: 403,
            statusMessage: '[Nuxt OG Image] Invalid purge token. Provide the signing secret as ?purge=<secret>.',
          })
        }
        await cache.removeItem(key).catch(() => {
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
        await cache.removeItem(key).catch(() => {
        })
      }
    }
  }
  if (!enabled) {
    // add http headers so the file isn't cached
    setHeader(ctx.e, 'Cache-Control', 'no-cache, no-store, must-revalidate')
    setHeader(ctx.e, 'Pragma', 'no-cache')
    setHeader(ctx.e, 'Expires', '0')
  }
  return {
    enabled,
    cachedItem,
    async update(item) {
      setHeader(ctx.e, 'X-OG-Cache', intentionallyEnabled ? 'MISS' : 'DISABLED')
      if (!enabled)
        return
      const value = Buffer.from(item as Uint8Array).toString('base64')
      const headers = {
        // avoid multi-tenancy cache issues
        'Vary': 'accept-encoding, host',
        'etag': `W/"${digest(value)}"`,
        'last-modified': new Date().toUTCString(),
        'cache-control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}, stale-if-error=${maxAge}`,
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
