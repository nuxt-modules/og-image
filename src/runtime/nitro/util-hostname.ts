import type { H3Event } from 'h3'
import { getRequestHost, getRequestProtocol } from 'h3'
import { withBase, withoutProtocol } from 'ufo'
import { useRuntimeConfig } from '#imports'

export function useHostname(e: H3Event) {
  const base = useRuntimeConfig().app.baseURL
  let host = getRequestHost(e, { xForwardedHost: true })
  if (host === 'localhost')
    host = process.env.NITRO_HOST || process.env.HOST || host
  let protocol = getRequestProtocol(e, { xForwardedProto: true })
  // edge case for supporting the port in development
  if (process.dev && process.env.NUXT_VITE_NODE_OPTIONS) {
    const envHost = JSON.parse(process.env.NUXT_VITE_NODE_OPTIONS).baseURL.replace('__nuxt_vite_node__', '')
    host = withoutProtocol(envHost)
    protocol = envHost.includes('https') ? 'https' : 'http'
  }
  const useHttp = process.dev || host.includes('127.0.0.1') || host.includes('localhost') || protocol === 'http'
  let port = host.includes(':') ? host.split(':').pop() : false
  // try and avoid adding port if not needed, mainly needed for dev and prerendering
  if ((process.dev || process.env.prerender || host.includes('localhost')) && !port)
    port = process.env.NITRO_PORT || process.env.PORT
  return withBase(base, `http${useHttp ? '' : 's'}://${host.includes(':') ? host.split(':')[0] : host}${port ? `:${port}` : ''}`)
}
