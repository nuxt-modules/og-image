import { joinURL } from 'ufo'
import { defu } from 'defu'
import type { OgImageOptions } from './types'
import { useRuntimeConfig } from '#imports'

export function getOgImagePath(pagePath: string, _options?: Partial<OgImageOptions>) {
  const options = defu(_options, useRuntimeConfig()['nuxt-og-image'].defaults)
  return joinURL('/__og-image__/image', pagePath, `og.${options.extension}`)
}

export function isInternalRoute(path: string) {
  const lastSegment = path.split('/').pop() || path
  return lastSegment.includes('.') || path.startsWith('/__') || path.startsWith('@')
}
