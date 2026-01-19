import type { H3Event } from 'h3'
import type { OgImageOptions, OgImageRuntimeConfig } from '../types'
import { useRuntimeConfig } from 'nitropack/runtime'
import { joinURL } from 'ufo'
import { buildOgImageUrl } from '../shared'

export interface GetOgImagePathResult {
  path: string
  hash?: string
}

export function getOgImagePath(_pagePath: string, _options?: Partial<OgImageOptions>): GetOgImagePathResult {
  const baseURL = useRuntimeConfig().app.baseURL
  const { defaults } = useOgImageRuntimeConfig()
  const extension = _options?.extension || defaults.extension
  const isStatic = import.meta.prerender
  // Include _path so the server knows which page to render
  // Pass defaults to skip encoding default values in URL
  const result = buildOgImageUrl({ ..._options, _path: _pagePath }, extension, isStatic, defaults)
  return {
    path: joinURL('/', baseURL, result.url),
    hash: result.hash,
  }
}

export function useOgImageRuntimeConfig(e?: H3Event) {
  const c = useRuntimeConfig(e)
  return {
    defaults: {},
    ...(c['nuxt-og-image'] as Record<string, any>),
    app: {
      baseURL: c.app.baseURL,
    },
  } as any as OgImageRuntimeConfig
}
