import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import { withBase } from 'ufo'
import { useRuntimeConfig } from '#imports'

export function useHostname(e: H3Event) {
  const base = useRuntimeConfig().app.baseURL
  const host = getRequestHeader(e, 'host') || process.env.NITRO_HOST || process.env.HOST || 'localhost'
  const protocol = getRequestHeader(e, 'x-forwarded-proto') || 'http'
  const useHttp = process.dev || host.includes('127.0.0.1') || host.includes('localhost') || protocol === 'http'
  let port = host.includes(':') ? host.split(':').pop() : false
  // try and avoid adding port if not needed, mainly needed for dev and prerendering
  if ((process.dev || process.env.prerender || host.includes('localhost')) && !port)
    port = process.env.NITRO_PORT || process.env.PORT
  return withBase(base, `http${useHttp ? '' : 's'}://${host.includes(':') ? host.split(':')[0] : host}${port ? `:${port}` : ''}`)
}
