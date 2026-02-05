/* eslint-disable ts/ban-ts-comment */
// @ts-nocheck - vue-router type recursion causes excessive stack depth
import type {
  DevToolsMetaDataExtraction,
  OgImageComponent,
  OgImageOptions,
  OgImageRuntimeConfig,
  RuntimeCompatibilitySchema,
} from '../../src/runtime/types'

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
  warnings?: string[]
}

export interface GlobalDebugResponse {
  runtimeConfig: OgImageRuntimeConfig
  componentNames: OgImageComponent[]
  siteConfigUrl?: string
  compatibility?: RuntimeCompatibilitySchema
}
