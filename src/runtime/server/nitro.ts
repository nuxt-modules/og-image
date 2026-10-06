import type { RequestEvent } from 'nuxt/server'
import type { OgImageOptionsInternal } from '../types'
import { getRequestURL, useRuntimeConfig } from 'nuxt/server'
import { withoutBase } from 'ufo'
import { withSiteUrl } from '#site-config/server/composables/utils'
import { getOgImagePath } from './utils'

type Options = Partial<OgImageOptionsInternal>

/**
 * Build the absolute OG image URL for a page. Without a page path, uses the current request path.
 */
export function getOgImageUrl(event: RequestEvent, options?: Options): string
export function getOgImageUrl(event: RequestEvent, pagePath: string, options?: Options): string
export function getOgImageUrl(event: RequestEvent, pathOrOptions?: string | Options, maybeOptions?: Options): string {
  const pagePath = typeof pathOrOptions === 'string'
    ? pathOrOptions
    // Same shape as the app side route.path: no base, no query.
    : withoutBase(getRequestURL(event).pathname, useRuntimeConfig().app.baseURL) || '/'
  const options = typeof pathOrOptions === 'string' ? maybeOptions : pathOrOptions
  const { path } = getOgImagePath(event, pagePath, options)
  // Match the app side og:image: canonical site URL, request origin as fallback.
  return withSiteUrl(event, path, { canonical: !import.meta.dev, withBase: true })
}
