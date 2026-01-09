import type {
  DevToolsMetaDataExtraction,
  OgImageComponent,
  OgImageOptions,
  OgImageRuntimeConfig,
} from '../../src/runtime/types'
import { useAsyncData } from '#imports'
import { encodeOgImageParams } from '../../src/runtime/shared/urlEncoding'
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
    // Build encoded URL with options for debug JSON
    const params = {
      ...optionsOverrides.value,
      key: ogImageKey.value || 'og',
      _path: path.value, // Include path for context
    }
    const encoded = encodeOgImageParams(params)
    const url = `/_og/d/${encoded || 'default'}.json`
    return appFetch.value(url)
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
