/* eslint-disable ts/ban-ts-comment */
// @ts-nocheck - vue-router type recursion causes excessive stack depth
import type {
  DevToolsMetaDataExtraction,
  FontConfig,
  OgImageComponent,
  OgImageOptions,
  OgImageRuntimeConfig,
  RuntimeCompatibilitySchema,
} from './runtime-types'

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
  fetchError?: { statusCode?: number, message: string, stack?: string[] }
}

export interface GlobalDebugResponse {
  runtimeConfig: OgImageRuntimeConfig
  componentNames: OgImageComponent[]
  siteConfigUrl?: string
  compatibility?: RuntimeCompatibilitySchema
  origin?: string
  fontRequirements?: {
    weights: number[]
    styles: string[]
    families: string[]
    hasDynamicBindings: boolean
  }
  resolvedFonts?: FontConfig[]
  availableFonts?: FontConfig[]
}
