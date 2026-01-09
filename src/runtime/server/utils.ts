import type { OgImageOptions, OgImageRuntimeConfig } from '#og-image/types'
import type { H3Event } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { joinURL } from 'ufo'
import { buildOgImageUrl } from '../shared'

export function getOgImagePath(_pagePath: string, _options?: Partial<OgImageOptions>) {
  const baseURL = useRuntimeConfig().app.baseURL
  const extension = _options?.extension || useOgImageRuntimeConfig().defaults.extension
  const isStatic = import.meta.prerender
  const url = buildOgImageUrl(_options || {}, extension, isStatic)
  return joinURL('/', baseURL, url)
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
