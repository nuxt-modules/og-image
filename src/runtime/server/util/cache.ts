import type { H3Error } from 'h3'
import type { OgImageRenderEventContext } from '../../types'
import { useStorage } from '#imports'
import { createError, getQuery, handleCacheHeaders, setHeader, setHeaders } from 'h3'
import { hash } from 'ohash'
import { withTrailingSlash } from 'ufo'
import { prefixStorage } from 'unstorage'
import { getCacheBase } from './cacheKey'

// TODO replace once https://github.com/unjs/nitro/pull/1969 is merged
export async function useOgImageBufferCache(ctx: OgImageRenderEventContext, options: {
  baseCacheKey: string | false
  cacheMaxAgeSeconds?: number
}): Promise<void | H3Error | { cachedItem: false | BufferSource, enabled: boolean, update: (image: BufferSource) => Promise<void> }> {
  const maxAge = Number(options.cacheMaxAgeSeconds)
  let enabled = !import.meta.dev && import.meta.env.MODE !== 'test' && maxAge > 0

  // Use the configurable cache base instead of the fixed one
  const cacheBase = getCacheBase()

  // Use regular storage - persistent cache is handled at build time
  const cache = prefixStorage(useStorage(), withTrailingSlash(cacheBase))

  const key = ctx.key

  // Add cache debug headers in development mode
  if (import.meta.dev || ctx.runtimeConfig.debug) {
    setHeader(ctx.e, 'X-OG-Image-Cache-Key', key)
    setHeader(ctx.e, 'X-OG-Image-Cache-Base', cacheBase)
    setHeader(ctx.e, 'X-OG-Image-Cache-Enabled', String(enabled))

    // Show if query params are being ignored
    if (ctx.runtimeConfig.cacheIgnoreQuery) {
      setHeader(ctx.e, 'X-OG-Image-Cache-Ignore-Query', 'true')
    }
  }

  // cache will invalidate if the options change
  let cachedItem: BufferSource | false = false
  if (enabled) {
    const hasItem = await cache.hasItem(key).catch((e) => {
      enabled = false
      return createError({
        cause: e,
        statusCode: 500,
        statusMessage: `[Nuxt OG Image] Failed to connect to cache ${cacheBase}. Response from cache: ${e.message}`,
      })
    })
    if (hasItem instanceof Error)
      return hasItem
    if (hasItem) {
      const { value, expiresAt, headers } = await cache.getItem(key).catch(() => ({
        value: null,
        expiresAt: Date.now(),
      })) as any
      if (typeof getQuery(ctx.e).purge !== 'undefined') {
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
      if (!enabled)
        return
      const value = Buffer.from(item).toString('base64')
      const headers = {
        // avoid multi-tenancy cache issues
        'Vary': 'accept-encoding, host',
        'etag': `W/"${hash(value)}"`,
        'last-modified': new Date().toUTCString(),
        'cache-control': `public, s-maxage=${maxAge}, stale-while-revalidate`,
      }
      setHeaders(ctx.e, headers)
      await cache.setItem(key, {
        value,
        headers,
        expiresAt: Date.now() + (maxAge * 1000),
      })
    },
  }
}
