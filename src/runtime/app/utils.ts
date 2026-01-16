import type { ActiveHeadEntry, Head } from '@unhead/vue'
import type { NuxtSSRContext } from 'nuxt/app'
import type { OgImageOptions, OgImagePrebuilt, OgImageRuntimeConfig } from '../types'
import { componentNames } from '#build/nuxt-og-image/components.mjs'
import { resolveUnrefHeadInput } from '@unhead/vue'
import { defu } from 'defu'
import { stringify } from 'devalue'
import { useHead, useRuntimeConfig } from 'nuxt/app'
import { joinURL, withQuery } from 'ufo'
import { buildOgImageUrl, generateMeta, separateProps } from '../shared'

type OgImagePayload = [string, OgImageOptions, Required<Head>['meta']]

declare module 'nuxt/app' {
  interface NuxtSSRContext {
    _ogImagePayloads?: OgImagePayload[]
    _ogImageInstance?: ActiveHeadEntry<Head>
    _ogImageDevtoolsInstance?: ActiveHeadEntry<Head>
  }
}

export function setHeadOgImagePrebuilt(input: OgImagePrebuilt) {
  if (import.meta.client) {
    return
  }
  const url = input.url
  if (!url)
    return
  const meta = generateMeta(url, input)
  useHead({ meta }, { tagPriority: 'high' })
}

export function createOgImageMeta(src: string, input: OgImageOptions | OgImagePrebuilt, ssrContext: NuxtSSRContext) {
  if (import.meta.client) {
    return
  }
  const { defaults } = useOgImageRuntimeConfig()
  const resolvedOptions = separateProps(defu(input, defaults))
  resolvedOptions.key = resolvedOptions.key || 'og'
  const payloads = ssrContext._ogImagePayloads || []
  const currentPayloadIdx = payloads.findIndex(([k]) => k === resolvedOptions.key)
  const _input = separateProps(defu(input, currentPayloadIdx >= 0 ? payloads[currentPayloadIdx]![1] : {}))
  let url: string | undefined = src || (input.url as string | undefined) || (resolvedOptions.url as string | undefined)
  if (!url)
    return
  if (input._query && Object.keys(input._query).length && url)
    url = withQuery(url, { _query: input._query })
  const meta = generateMeta(url, resolvedOptions)
  if (currentPayloadIdx === -1) {
    payloads.push([resolvedOptions.key!, _input, meta as any])
  }
  else {
    payloads[currentPayloadIdx] = [resolvedOptions.key!, _input, meta as any]
  }

  ssrContext._ogImageInstance?.dispose()
  ssrContext._ogImageInstance = useHead({
    meta() {
      const finalPayload = ssrContext._ogImagePayloads || []
      return finalPayload.flatMap(([_, __, meta]) => meta)
    },
  }, {
    processTemplateParams: true,
    tagPriority: 35,
  })

  // devtools script injection for dev mode and prerender cache
  if (import.meta.dev || import.meta.prerender) {
    ssrContext._ogImageDevtoolsInstance?.dispose()
    ssrContext._ogImageDevtoolsInstance = useHead({
      script: [{
        id: 'nuxt-og-image-options',
        type: 'application/json',
        processTemplateParams: true,
        innerHTML: () => {
          const devtoolsPayload = (ssrContext._ogImagePayloads || []).map(([key, options]) => {
            const payload = resolveUnrefHeadInput(options) as any
            if (payload.props && typeof payload.props.title === 'undefined')
              payload.props.title = '%s'
            payload.component = resolveComponentName(options.component, defaults.component || '')
            payload.key = key
            delete payload.url
            if (payload._query && Object.keys(payload._query).length === 0) {
              delete payload._query
            }
            const final: Record<string, any> = {}
            for (const k in payload) {
              if (payload[k] !== (defaults as any)[k]) {
                final[k] = payload[k]
              }
            }
            return final
          })
          return stringify(devtoolsPayload)
        },
        tagPosition: 'bodyClose',
      }],
    })
  }

  ssrContext._ogImagePayloads = payloads
}

export function resolveComponentName(component: OgImageOptions['component'], fallback: string): OgImageOptions['component'] {
  component = component || fallback || componentNames?.[0]?.pascalName
  // try and fix component name if we're using a shorthand (i.e Banner instead of OgImageBanner)
  if (component && componentNames) {
    const originalName = component
    for (const component of componentNames) {
      // Strip renderer suffix for matching (e.g., OgImageComplexTestSatori -> OgImageComplexTest)
      const basePascalName = component.pascalName.replace(/(Satori|Chromium|Takumi)$/, '')
      const baseKebabName = component.kebabName.replace(/-(satori|chromium|takumi)$/, '')
      if (basePascalName.endsWith(originalName) || baseKebabName.endsWith(originalName)) {
        return component.pascalName
      }
    }
  }
  return component
}

export interface GetOgImagePathResult {
  path: string
  hash?: string
}

export function getOgImagePath(_pagePath: string, _options?: Partial<OgImageOptions>): GetOgImagePathResult {
  const runtimeConfig = useRuntimeConfig()
  const baseURL = runtimeConfig.app.baseURL
  const { defaults } = useOgImageRuntimeConfig()
  const extension = _options?.extension || defaults?.extension || 'png'
  const isStatic = import.meta.prerender
  // Build URL with encoded options (Cloudinary-style)
  // Include _path so the server knows which page to render
  // Pass defaults to skip encoding default values in URL
  const result = buildOgImageUrl({ ..._options, _path: _pagePath }, extension, isStatic, defaults)
  let path = joinURL('/', baseURL, result.url)
  // For dynamic images, append build ID to bust external platform caches (Telegram, Facebook, etc.)
  if (!isStatic && runtimeConfig.app.buildId) {
    path = withQuery(path, { _v: runtimeConfig.app.buildId })
  }
  return {
    path,
    hash: result.hash,
  }
}

export function useOgImageRuntimeConfig() {
  const c = useRuntimeConfig()
  return {
    defaults: {},
    ...(c['nuxt-og-image'] as Record<string, any>),
    app: {
      baseURL: c.app.baseURL,
    },
  } as any as OgImageRuntimeConfig
}
