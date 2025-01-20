import type {
  DevToolsMetaDataExtraction,
  OgImageComponent,
  OgImageRuntimeConfig,
} from '../../src/runtime/types'
import { appFetch, useAsyncData } from '#imports'
import { joinURL } from 'ufo'
import { globalRefreshTime, ogImageKey, optionsOverrides, path, refreshTime } from '~/util/logic'

export function fetchPathDebug() {
  return useAsyncData<DevToolsMetaDataExtraction[]>(async () => {
    if (!appFetch.value)
      return []
    return appFetch.value(joinURL('/__og-image__/image', path.value, `${ogImageKey.value || 'og'}.json`), {
      query: optionsOverrides.value,
    })
  }, {
    watch: [path, refreshTime, ogImageKey],
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
