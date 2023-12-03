import { joinURL } from 'ufo'
import { defu } from 'defu'
import type { OgImageOptions, OgImageRuntimeConfig } from './types'
import { useRuntimeConfig } from '#imports'

export * from './utils.pure'

export function getOgImagePath(pagePath: string, _options?: Partial<OgImageOptions>) {
  const options = defu(_options, useOgImageRuntimeConfig().defaults)
  return joinURL('/__og-image__/image', pagePath, `og.${options.extension}`)
}

export function useOgImageRuntimeConfig() {
  return useRuntimeConfig()['nuxt-og-image'] as any as OgImageRuntimeConfig
}
