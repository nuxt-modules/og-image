/* eslint-disable ts/ban-ts-comment */
// @ts-nocheck - vue-router type recursion causes excessive stack depth
import type {
  DevToolsMetaDataExtraction,
  OgImageComponent,
  OgImageOptions,
  OgImageRuntimeConfig,
  RuntimeCompatibilitySchema,
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

export interface PathDebugResponse {
  extract: DevToolsPayload
  siteUrl?: string
  compatibilityHints?: string[]
  vnodes?: Record<string, unknown>
  svg?: string
}

export interface GlobalDebugResponse {
  runtimeConfig: OgImageRuntimeConfig
  componentNames: OgImageComponent[]
  siteConfigUrl?: string
  compatibility?: RuntimeCompatibilitySchema
}

export function fetchPathDebug() {
  return useAsyncData<PathDebugResponse>('path-debug', async () => {
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
    watch: [appFetch, path, refreshTime, ogImageKey],
  })
}

export function fetchGlobalDebug() {
  return useAsyncData<GlobalDebugResponse>('global-debug', () => {
    if (!appFetch.value)
      return { runtimeConfig: {} as OgImageRuntimeConfig, componentNames: [] }
    return appFetch.value('/_og/debug.json')
  }, {
    watch: [appFetch, globalRefreshTime],
  })
}
