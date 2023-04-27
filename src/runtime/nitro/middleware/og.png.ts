import { Buffer } from 'node:buffer'
import { createError, defineEventHandler, sendRedirect, setHeader } from 'h3'
import { joinURL, parseURL, withBase, withoutTrailingSlash } from 'ufo'
import { prefixStorage } from 'unstorage'
import { fetchOptions, useHostname } from '../utils'
import { useProvider } from '#nuxt-og-image/provider'
import { useRuntimeConfig, useStorage } from '#imports'

export default defineEventHandler(async (e) => {
  const { runtimeBrowser, runtimeCacheStorage } = useRuntimeConfig()['nuxt-og-image']

  const path = parseURL(e.path).pathname
  // convert to regex
  if (!path.endsWith('__og_image__/og.png'))
    return

  const basePath = withoutTrailingSlash(path
    .replace('__og_image__/og.png', ''),
  )

  const options = await fetchOptions(e, basePath)
  if (process.env.NODE_ENV === 'production' && !process.env.prerender && !runtimeBrowser && options.provider === 'browser')
    return sendRedirect(e, joinURL(useHostname(e), '__nuxt_og_image__/browser-provider-not-supported.png'))
  const provider = await useProvider(options.provider!)
  if (!provider) {
    throw createError({
      statusCode: 500,
      statusMessage: `Provider ${options.provider} is missing.`,
    })
  }
  const cache = prefixStorage(useStorage(), 'og-image-cache:images')
  const key = options.cacheKey || e.node.req.url as string
  let png
  if (runtimeCacheStorage && await cache.hasItem(key)) {
    const { value, expiresAt } = await cache.getItem(key) as any
    if (expiresAt > Date.now()) {
      setHeader(e, 'Cache-Control', 'public, max-age=31536000')
      setHeader(e, 'Content-Type', 'image/png')
      png = Buffer.from(value, 'base64')
    }
    else {
      await cache.removeItem(key)
    }
  }
  if (!png) {
    try {
      png = await provider.createPng(withBase(basePath, useHostname(e)), options) as Uint8Array
      if (png && runtimeCacheStorage && options.static) {
        // set cache
        const base64png = Buffer.from(png).toString('base64')
        await cache.setItem(key, { value: base64png, expiresAt: Date.now() + (options.cacheTtl || 0) })
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
    if (!process.dev && options.static) {
      setHeader(e, 'Cache-Control', 'public, max-age=31536000')
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
