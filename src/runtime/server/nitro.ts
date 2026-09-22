import type { H3Event } from '#nuxtseo/h3'
import type { OgImageOptionsInternal } from '../types'
import { joinURL } from 'ufo'
import { getRequestURL } from '#nuxtseo/h3'
import { getOgImagePath } from './utils'

export function getOgImageUrl(_pagePath: string, _options?: Partial<OgImageOptionsInternal>, event?: H3Event): string {
  const { path } = getOgImagePath(_pagePath, _options, event)
  if (!event)
    return path
  const origin = getRequestURL(event, { xForwardedHost: true }).origin
  return joinURL(origin, path)
}
