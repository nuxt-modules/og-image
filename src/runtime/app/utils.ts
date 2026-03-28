import type { ActiveHeadEntry, Head } from '@unhead/vue'
import type { NuxtSSRContext } from 'nuxt/app'
import type { OgImageOptions, OgImageOptionsInternal, OgImagePrebuilt, OgImageRuntimeConfig } from '../types'
import { componentNames } from '#build/nuxt-og-image/components.mjs'
import { resolveUnrefHeadInput } from '@unhead/vue'
import { defu } from 'defu'
import { stringify } from 'devalue'
import { useHead, useRuntimeConfig } from 'nuxt/app'
import { joinURL, withQuery } from 'ufo'
import { logger } from '../logger'
import { buildOgImageUrl, generateMeta, separateProps } from '../shared'

const RE_RENDERER_SUFFIX = /(Satori|Browser|Takumi)$/

type OgImagePayload = [string, OgImageOptionsInternal, Required<Head>['meta']]

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
            if (typeof payload.component === 'string') {
              payload.component = resolveComponentName(payload.component)
            }
            else if (payload.component) {
              if (import.meta.dev)
                logger.warn(`defineOgImage() received a non-string component value (${typeof payload.component}). Pass the component name as a plain string.`)
              delete payload.component
            }
            payload.key = key
            delete payload.url
            if (payload._query && Object.keys(payload._query).length === 0) {
              delete payload._query
            }
            if (payload.props && typeof payload.props === 'object' && Object.keys(payload.props).length === 0) {
              delete payload.props
            }
            const ALWAYS_INCLUDE = new Set(['component', '_hash', 'key', 'fonts'])
            const final: Record<string, any> = {}
            for (const k in payload) {
              if (payload[k] === '')
                continue
              if (ALWAYS_INCLUDE.has(k) || payload[k] !== (defaults as any)[k]) {
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

export function resolveComponentName(component: OgImageOptionsInternal['component']): OgImageOptionsInternal['component'] {
  component = component || componentNames?.[0]?.pascalName
  // try and fix component name if we're using a shorthand (i.e Banner instead of OgImageBanner)
  if (component && componentNames) {
    const originalName = component
    // Normalize dot-notation to PascalCase (Default.takumi → DefaultTakumi)
    const normalizedName = originalName.split('.').map((s, i) => i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)).join('')
    // Strip renderer suffix to get the base input name (DefaultTakumi → Default)
    const inputBase = normalizedName.replace(RE_RENDERER_SUFFIX, '')
    for (const component of componentNames) {
      // Exact match with normalized name
      if (component.pascalName === normalizedName)
        return component.pascalName
      // Strip renderer suffix for matching (e.g., OgImageComplexTestSatori -> OgImageComplexTest)
      const basePascalName = component.pascalName.replace(RE_RENDERER_SUFFIX, '')
      if (basePascalName === originalName || basePascalName === inputBase)
        return component.pascalName
      // Strip directory prefix and check all possible base names
      // including dedup-aware variants (Nuxt merges overlapping prefix/filename words)
      const prefixes = [
        { prefix: 'OgImageCommunity', overlapWord: 'Community' },
        { prefix: 'OgImageTemplate', overlapWord: 'Template' },
        { prefix: 'OgImage', overlapWord: 'Image' },
      ] as const
      for (const { prefix, overlapWord } of prefixes) {
        if (!basePascalName.startsWith(prefix))
          continue
        const withoutPrefix = basePascalName.slice(prefix.length)
        if (withoutPrefix === originalName || withoutPrefix === inputBase)
          return component.pascalName
        // Dedup-aware: re-prepend the overlap word
        if (withoutPrefix && withoutPrefix !== overlapWord) {
          const withOverlap = overlapWord + withoutPrefix
          if (withOverlap === originalName || withOverlap === inputBase)
            return component.pascalName
        }
        break
      }
    }
  }
  return component
}

export interface GetOgImagePathResult {
  path: string
  hash?: string
}

/**
 * @deprecated Use the return value of `defineOgImage()` instead, which now returns an array of generated paths.
 */
export function getOgImagePath(_pagePath: string, _options?: Partial<OgImageOptionsInternal>): GetOgImagePathResult {
  const runtimeConfig = useRuntimeConfig()
  const baseURL = runtimeConfig.app.baseURL
  const { defaults, security } = useOgImageRuntimeConfig()
  const extension = _options?.extension || defaults?.extension || 'png'
  const isStatic = import.meta.prerender
  const options: Record<string, any> = { ..._options, _path: _pagePath }
  // Include the component template hash so that template changes produce different URLs,
  // busting CDN/build caches (Vercel, social platform crawlers like Twitter/Facebook, etc.)
  const componentName = _options?.component || componentNames?.[0]?.pascalName
  const component = componentNames?.find((c: any) => c.pascalName === componentName || c.kebabName === componentName)
  if (component?.hash)
    options._componentHash = component.hash
  // Build URL with encoded options (Cloudinary-style)
  // Include _path so the server knows which page to render
  // Pass defaults to skip encoding default values in URL
  const result = buildOgImageUrl(options, extension, isStatic, defaults, security?.secret || undefined)
  const path = joinURL('/', baseURL, result.url)
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
