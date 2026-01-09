import type {
  DevToolsMetaDataExtraction,
  OgImageComponent,
  OgImageOptions,
  OgImageRuntimeConfig,
} from '../../src/runtime/types'
import { useAsyncData } from '#imports'
import { joinURL } from 'ufo'
import { globalRefreshTime, ogImageKey, optionsOverrides, path, refreshTime } from '../util/logic'
import { appFetch } from './rpc'

export interface DevToolsPayload {
  options: OgImageOptions[]
  socialPreview: {
    root: Record<string, string>
    images: DevToolsMetaDataExtraction[]
  }
  siteUrl?: string
}

export function fetchPathDebug() {
  return useAsyncData<{ extract: DevToolsPayload, siteUrl?: string }>(async () => {
    if (!appFetch.value)
      return { extract: { options: [], socialPreview: { root: {}, images: [] } } }
    return appFetch.value(joinURL('/_og/d', path.value, `${ogImageKey.value || 'og'}.json`), {
      query: optionsOverrides.value,
    })
  }, {
    watch: [path, refreshTime, ogImageKey],
  })
}

export function fetchGlobalDebug() {
  // @ts-expect-error untyped
  return useAsyncData<{ runtimeConfig: OgImageRuntimeConfig, componentNames: OgImageComponent[] }>('global-debug', () => {
    if (!appFetch.value)
      return { runtimeConfig: {} }
    return appFetch.value('/_og/debug.json')
  }, {
    watch: [globalRefreshTime],
  })
}
