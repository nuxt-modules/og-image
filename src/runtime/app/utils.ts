import type { ActiveHeadEntry, Head, VueHeadClient } from '@unhead/vue'
import type { NuxtSSRContext } from 'nuxt/app'
import type { OgImageOptions, OgImageOptionsInternal, OgImagePrebuilt, OgImageRuntimeConfig } from '../types'
import { componentNames } from '#build/nuxt-og-image/components.mjs'
import { resolveUnrefHeadInput } from '@unhead/vue'
import { defu } from 'defu'
import { stringify } from 'devalue'
import { useHead, useRuntimeConfig } from 'nuxt/app'
import { joinURL, withQuery } from 'ufo'
import { toValue } from 'vue'
import { logger } from '../logger'
import { buildOgImageUrl, generateMeta, separateProps } from '../shared'

const RE_RENDERER_SUFFIX = /(Satori|Browser|Takumi)$/

/**
 * Payload format: [ogKey, options, basePath]
 * basePath is stored so the lazy meta() callback can rebuild URLs
 * after injecting head-derived title/description.
 */
type OgImagePayload = [string, OgImageOptionsInternal, string]

/**
 * Extract title and description from head entries set by useSeoMeta / useHead.
 *
 * useSeoMeta stores description in `_flatMeta` (flat object keyed by meta name),
 * while useHead stores it in `input.meta` (array of { name, content } objects).
 * Title is hoisted to `entry.input.title` by both APIs.
 */
function extractHeadSeoProps(head: VueHeadClient): { title?: string, description?: string } {
  const result: { title?: string, description?: string } = {}
  try {
    for (const entry of head.entries.values()) {
      const input = toValue(entry.input) as Record<string, any> | undefined
      if (!input || typeof input !== 'object')
        continue

      // Title: both useSeoMeta and useHead hoist title to entry.input.title
      if ('title' in input) {
        const t = toValue(input.title)
        if (typeof t === 'string')
          result.title = t
      }

      // Description from useSeoMeta: stored in _flatMeta
      if (input._flatMeta && typeof input._flatMeta === 'object') {
        const d = toValue(input._flatMeta.description) || toValue(input._flatMeta.ogDescription)
        if (typeof d === 'string')
          result.description = d
      }

      // Description from useHead({ meta: [...] })
      if (Array.isArray(input.meta)) {
        for (const meta of input.meta) {
          const m = toValue(meta)
          if (!m || typeof m !== 'object')
            continue
          if (m.name === 'description' || m.property === 'og:description') {
            const c = toValue(m.content)
            if (typeof c === 'string')
              result.description = c
          }
        }
      }
    }
  }
  catch (e) {
    if (import.meta.dev)
      logger.warn('Failed to extract SEO props from head entries', e)
  }
  return result
}

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

export function createOgImageMeta(src: string, input: OgImageOptions | OgImagePrebuilt, ssrContext: NuxtSSRContext, pagePath?: string, head?: VueHeadClient) {
  if (import.meta.client) {
    return
  }
  const { defaults } = useOgImageRuntimeConfig()
  const resolvedOptions = separateProps(defu(input, defaults))
  resolvedOptions.key = resolvedOptions.key || 'og'
  const payloads = ssrContext._ogImagePayloads || []
  const currentPayloadIdx = payloads.findIndex(([k]) => k === resolvedOptions.key)
  const _input = separateProps(defu(input, currentPayloadIdx >= 0 ? payloads[currentPayloadIdx]![1] : {}))
  if (!src && !input.url && !resolvedOptions.url)
    return
  const basePath = pagePath || '/'
  if (currentPayloadIdx === -1) {
    payloads.push([resolvedOptions.key!, _input, basePath])
  }
  else {
    payloads[currentPayloadIdx] = [resolvedOptions.key!, _input, basePath]
  }

  ssrContext._ogImageInstance?.dispose()
  ssrContext._ogImageInstance = useHead({
    // Meta is generated lazily so that title/description from useSeoMeta / useHead
    // are available regardless of call ordering (all component setups have completed
    // by the time Unhead resolves tags).
    meta() {
      const finalPayload = ssrContext._ogImagePayloads || []
      // Extract head SEO props once for all payloads
      const seo = head ? extractHeadSeoProps(head) : undefined
      return finalPayload.flatMap(([_, options, payloadBasePath]) => {
        const opts = { ...options, props: { ...options.props } }
        // Inject title/description from head entries if not explicitly set
        if (seo) {
          if (seo.title && typeof opts.props.title === 'undefined')
            opts.props.title = seo.title
          if (seo.description && typeof opts.props.description === 'undefined')
            opts.props.description = seo.description
        }
        const { path: resolvedUrl } = getOgImagePath(payloadBasePath, opts)
        const finalUrl = opts._query && Object.keys(opts._query).length
          ? withQuery(resolvedUrl, { _query: opts._query })
          : resolvedUrl
        // Update prerender paths to match the lazily resolved URL
        if (import.meta.prerender && ssrContext.event) {
          const prerenderPaths: Map<string, string> | undefined = ssrContext.event.context._ogImagePrerenderPaths
          if (prerenderPaths) {
            const ogKey = opts.key || 'og'
            prerenderPaths.set(ogKey, (finalUrl.split('?')[0] || finalUrl).replace(/,/g, '%2C'))
          }
        }
        return generateMeta(finalUrl, opts)
      })
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
          // Extract head SEO props once for all devtools payloads
          const seo = head ? extractHeadSeoProps(head) : undefined
          const devtoolsPayload = (ssrContext._ogImagePayloads || []).map(([key, options]) => {
            const payload = resolveUnrefHeadInput(options) as any
            // Use %s template param for title so unhead resolves it with titleTemplate
            if (payload.props && typeof payload.props.title === 'undefined')
              payload.props.title = '%s'
            // Inject description from head entries for devtools/prerender cache
            if (seo?.description && payload.props && typeof payload.props.description === 'undefined')
              payload.props.description = seo.description
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
