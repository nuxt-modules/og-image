import { Buffer } from 'node:buffer'
import { createError, defineEventHandler, sendRedirect, setHeader } from 'h3'
import { joinURL, parseURL, withoutLeadingSlash, withoutTrailingSlash } from 'ufo'
import { hash } from 'ohash'
import { fetchOptionsCached } from '../utils'
import { useNitroCache } from '../../cache'
import { useProvider } from '#nuxt-og-image/provider'
import { useNitroOrigin, useRuntimeConfig } from '#imports'

export default defineEventHandler(async (e) => {
  const { runtimeBrowser } = useRuntimeConfig()['nuxt-og-image']

  const path = parseURL(e.path).pathname
  // convert to regex
  if (!path.endsWith('__og_image__/og.png'))
    return

  const basePath = withoutTrailingSlash(path
    .replace('__og_image__/og.png', ''),
  )

  const options = await fetchOptionsCached(e, basePath)
  if (process.env.NODE_ENV === 'production' && !process.env.prerender && !runtimeBrowser && options.provider === 'browser')
    return sendRedirect(e, joinURL(useNitroOrigin(e), '__nuxt_og_image__/browser-provider-not-supported.png'))
  const provider = await useProvider(options.provider!)
  if (!provider) {
    throw createError({
      statusCode: 500,
      statusMessage: `Provider ${options.provider} is missing.`,
    })
  }

  // cache will invalidate if the options change
  const key = [
    withoutLeadingSlash((options.path === '/' || !options.path) ? 'index' : options.path).replaceAll('/', '-'),
    `og-${hash(options)}`,
  ].join(':')
  const { enabled: cacheEnabled, cachedItem, update } = await useNitroCache<string>(e, 'nuxt-og-image', {
    key,
    cacheTtl: options.cacheTtl || 0,
    cache: !process.dev && options.cache!,
    headers: true,
  })
  let png
  if (cachedItem)
    png = Buffer.from(cachedItem, 'base64')

  if (!png) {
    try {
      png = await provider.createPng(options) as Uint8Array
      if (png) {
        // set cache
        const base64png = Buffer.from(png).toString('base64')
        await update(base64png)
      }
    }
    catch (err) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to create og image: ${err.message}`,
      })
    }
  }

  if (png) {
    if (cacheEnabled && options.cacheTtl) {
      setHeader(e, 'Cache-Control', `public, max-age=${Math.round(options.cacheTtl / 1000)}`)
    }
    else {
      // add http headers so the file isn't cached
      setHeader(e, 'Cache-Control', 'no-cache, no-store, must-revalidate')
      setHeader(e, 'Pragma', 'no-cache')
      setHeader(e, 'Expires', '0')
    }
    setHeader(e, 'Content-Type', 'image/png')
    return png
  }

  throw createError({
    statusCode: 500,
    statusMessage: 'Failed to create og image, unknown error.',
  })
})
