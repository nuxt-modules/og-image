import { joinURL, withQuery } from 'ufo'
import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import type { OgImageOptions } from '../../types'

export function fetchOptions(path: string) {
  return $fetch<OgImageOptions>(joinURL(path, '__og_image__/options'))
}

export function renderIsland(payload: OgImageOptions) {
  return $fetch<{ html: string; head: any }>(withQuery(`/__nuxt_island/${payload.component}`, {
    props: JSON.stringify(payload),
  }))
}

export function useHostname(e: H3Event) {
  const host = getRequestHeader(e, 'host') || 'localhost:3000'
  const protocol = getRequestHeader(e, 'x-forwarded-proto') || 'http'
  if (protocol.startsWith('http'))
    return `${protocol}://${host}`
  return `http${process.env.NODE_ENV === 'development' ? '' : 's'}://${host}`
}
