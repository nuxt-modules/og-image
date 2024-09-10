import { appFetch, useAsyncData } from '#imports'
import { joinURL } from 'ufo'
import { globalRefreshTime, optionsOverrides, path, refreshTime } from '~/util/logic'
import type { OgImageComponent, OgImageOptions, OgImageRuntimeConfig } from '../../src/runtime/types'

export function fetchPathDebug() {
  return useAsyncData<{ siteConfig: { url?: string }, options: OgImageOptions, vnodes: Record<string, any> }>(() => {
    if (!appFetch.value)
      return { siteCofig: {}, options: {}, vnodes: {} }
    return appFetch.value(joinURL('/__og-image__/image', path.value, 'og.json'), {
      query: optionsOverrides.value,
    })
  }, {
    watch: [path, refreshTime],
  })
}

export function fetchGlobalDebug() {
  return useAsyncData<{ runtimeConfig: OgImageRuntimeConfig, componentNames: OgImageComponent[] }>(() => {
    if (!appFetch.value)
      return { runtimeConfig: {} }
    return appFetch.value('/__og-image__/debug.json')
  }, {
    watch: [globalRefreshTime],
  })
}
