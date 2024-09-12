import type { OgImageOptions, OgImageRuntimeConfig } from './types'
import { useRuntimeConfig } from '#imports'
import { defu } from 'defu'
import { joinURL } from 'ufo'

// must work in both Nuxt an

export * from './pure'

export function getOgImagePath(pagePath: string, _options?: Partial<OgImageOptions>) {
  const baseURL = useRuntimeConfig().app.baseURL
  const options = defu(_options, useOgImageRuntimeConfig().defaults)
  return joinURL('/', baseURL, `__og-image__/${import.meta.prerender ? 'static' : 'image'}`, pagePath, `og.${options.extension}`)
}

export function useOgImageRuntimeConfig() {
  return useRuntimeConfig()['nuxt-og-image'] as any as OgImageRuntimeConfig
}
