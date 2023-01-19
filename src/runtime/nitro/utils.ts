import { joinURL, withQuery } from 'ufo'
import type { H3Event } from 'h3'
import { getRequestHeader, getRequestHeaders } from 'h3'
import type { OgImagePayload } from '../../types'

export function fetchPayload(path: string) {
  return $fetch<OgImagePayload>(joinURL(path, '__og_image__/payload'))
}

export function renderIsland(island: string, payload: Record<string, any>) {
  return $fetch<{ html: string; head: any }>(withQuery(`/__nuxt_island/${island}`, {
    props: JSON.stringify(payload),
  }))
}

export function useHostname(e: H3Event) {
  console.log(getRequestHeader(e, 'host'), getRequestHeaders(e))
  const host = getRequestHeader(e, 'host') || 'localhost:3000'
  const protocol = getRequestHeader(e, 'x-forwarded-proto') || 'http'
  if (protocol.startsWith('http'))
    return `${protocol}://${host}`
  return `http${process.env.NODE_ENV === 'development' ? '' : 's'}://${host}`
}
