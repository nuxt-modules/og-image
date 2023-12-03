import { prefixStorage } from 'unstorage'
import { getQuery, handleCacheHeaders, setHeader, setHeaders } from 'h3'
import { withTrailingSlash } from 'ufo'
import { hash } from 'ohash'
import type { H3EventOgImageRender } from './types'
import { useStorage } from '#imports'

// TODO replace once https://github.com/unjs/nitro/pull/1969 is merged
export async function useOgImageBufferCache(ctx: H3EventOgImageRender, options: {
  baseCacheKey: string | false
  cacheMaxAgeSeconds?: number
}): Promise<void | { cachedItem: false | BufferSource, enabled: boolean, update: (image: BufferSource) => Promise<void> }> {
  const maxAge = Number(options.cacheMaxAgeSeconds)
  const enabled = !import.meta.dev && import.meta.env.MODE !== 'test' && maxAge > 0
  const cache = prefixStorage(useStorage(), withTrailingSlash(options.baseCacheKey || '/'))
  const key = ctx.key

  // cache will invalidate if the options change
  let cachedItem: BufferSource | false = false
  if (enabled && await cache.hasItem(key).catch(() => false)) {
    const { value, expiresAt, headers } = await cache.getItem(key).catch(() => ({ value: null, expiresAt: Date.now() })) as any
    if (typeof getQuery(ctx.e).purge !== 'undefined') {
      await cache.removeItem(key).catch(() => {})
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
      )
        return

      setHeaders(ctx.e, headers)
    }
    else {
      // expired
      await cache.removeItem(key).catch(() => {})
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
