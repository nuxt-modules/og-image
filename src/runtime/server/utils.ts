import type { OgImageOptions, OgImageRuntimeConfig } from '#og-image/types'
import type { H3Event } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { joinURL, withQuery } from 'ufo'

export function getOgImagePath(pagePath: string, _options?: Partial<OgImageOptions>) {
  const baseURL = useRuntimeConfig().app.baseURL
  const extension = _options?.extension || useOgImageRuntimeConfig().defaults.extension
  const path = joinURL('/', baseURL, `__og-image__/${import.meta.prerender ? 'static' : 'image'}`, pagePath, `og.${extension}`)
  if (Object.keys(_options?._query || {}).length) {
    return withQuery(path, _options!._query!)
  }
  return path
}

export function useOgImageRuntimeConfig(e?: H3Event) {
  const c = useRuntimeConfig(e)
  return {
    ...(c['nuxt-og-image'] as Record<string, any>),
    app: {
      baseURL: c.app.baseURL,
    },
  } as any as OgImageRuntimeConfig
}
