import type { H3Event } from '#nuxtseo/h3'
import type { OgImageOptionsInternal } from '../types'
import { withSiteUrl } from '#site-config/server/composables/utils'
import { getOgImagePath } from './utils'

export function getOgImageUrl(event: H3Event, _pagePath: string, _options?: Partial<OgImageOptionsInternal>): string {
  const { path } = getOgImagePath(event, _pagePath, _options)
  // Match the app side og:image: canonical site URL, request origin as fallback.
  return withSiteUrl(event, path, { canonical: !import.meta.dev })
}
