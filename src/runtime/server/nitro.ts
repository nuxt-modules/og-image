import type { H3Event } from '#nuxtseo/h3'
import type { OgImageOptionsInternal } from '../types'
import { parseURL, withoutBase } from 'ufo'
import { useRuntimeConfig } from '#nuxtseo/nitro'
import { withSiteUrl } from '#site-config/server/composables/utils'
import { getOgImagePath } from './utils'

type Options = Partial<OgImageOptionsInternal>

/**
 * Build the absolute OG image URL for a page. Without a page path, uses the current request path.
 */
export function getOgImageUrl(event: H3Event, options?: Options): string
export function getOgImageUrl(event: H3Event, pagePath: string, options?: Options): string
export function getOgImageUrl(event: H3Event, pathOrOptions?: string | Options, maybeOptions?: Options): string {
  const pagePath = typeof pathOrOptions === 'string'
    ? pathOrOptions
    // Same shape as the app side route.path: no base, no query.
    : withoutBase(parseURL(event.path).pathname, useRuntimeConfig(event).app.baseURL) || '/'
  const options = typeof pathOrOptions === 'string' ? maybeOptions : pathOrOptions
  const { path } = getOgImagePath(event, pagePath, options)
  // Match the app side og:image: canonical site URL, request origin as fallback.
  return withSiteUrl(event, path, { canonical: !import.meta.dev })
}
