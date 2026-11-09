import type { ActiveHeadEntry, Head, ResolvableMeta, VueHeadClient } from '@unhead/vue'
import type { NuxtSSRContext } from 'nuxt/app'
import type { OgImageComponent, OgImageOptions, OgImageOptionsInternal, OgImagePrebuilt, OgImageRuntimeConfig } from '../types'
import type { OgMeta } from './compiledMeta'
import { defu } from 'defu'
import { stringify } from 'devalue'
import { injectHead, useHead, useRequestEvent, useRuntimeConfig } from 'nuxt/app'
import { joinURL, withQuery } from 'ufo'
import { isRef, toValue } from 'vue'
import { readEntry } from '#build/nuxt-og-image/compiled-meta-server.mjs'
import { metaShapes } from '#build/nuxt-og-image/compiled-meta.mjs'
import { componentNames } from '#build/nuxt-og-image/components.mjs'
import { createSitePathResolver, withSiteUrl } from '#site-config/app'
import { buildOgImageUrl, generateMeta, separateProps } from '../shared'
import { compileOgMeta, OG_META_MODES, rewriteImageUrl } from './compiledMeta'

/**
 * Recursively unwrap refs/computed/getters in a head input object.
 *
 * Replaces `resolveUnrefHeadInput` from `@unhead/vue`, which was removed in
 * Unhead v3. The local walker resolves reactive inputs before encoding them.
 */
export function resolveUnrefHeadInput(input: any): any {
  if (input == null)
    return input
  if (isRef(input) || typeof input === 'function')
    return resolveUnrefHeadInput(toValue(input))
  if (Array.isArray(input))
    return input.map(resolveUnrefHeadInput)
  if (typeof input === 'object') {
    const result: Record<string, any> = {}
    for (const k in input)
      result[k] = resolveUnrefHeadInput(input[k])
    return result
  }
  return input
}

const RE_RENDERER_SUFFIX = /(Satori|Browser|Takumi)$/

/**
 * Payload format: [ogKey, options, basePath]
 * basePath is stored so the lazy meta() callback can rebuild URLs
 * after injecting head-derived title/description.
 */
type OgImagePayload = [string, OgImageOptionsInternal, string]

interface SeoProps { title?: string, description?: string }

interface HeadEntryLike { _i: number }

// Entries og-image pushes, by head. Their getters and values read the head entries themselves.
const ownEntries = new WeakMap<object, Set<number>>()

/** Marks an entry og-image pushed, so the entry readers skip it. */
export function markOwnEntry(head: object, entry: { _i: number } | undefined): void {
  if (!entry)
    return
  let ids = ownEntries.get(head)
  if (!ids)
    ownEntries.set(head, ids = new Set())
  ids.add(entry._i)
}

/** Whether og-image pushed the entry. */
export function isOwnEntry(head: object, entry: HeadEntryLike): boolean {
  return !!ownEntries.get(head)?.has(entry._i)
}

/**
 * The title and description of the `useSeoMeta` entries of a head.
 *
 * Only reads `useSeoMeta` entries, so plain `useHead({ title })` page titles do not leak into
 * og:image URLs (#573). `readEntry()` reads compiled and loose entries alike, with their values
 * settled and the packed meta of `useSeoMeta` as meta tags. Without it, nothing is read.
 */
export function readHeadSeoProps(head: VueHeadClient | object): SeoProps {
  const result: SeoProps = {}
  if (!readEntry)
    return result
  try {
    for (const entry of (head as VueHeadClient).entries.values()) {
      if (isOwnEntry(head, entry as HeadEntryLike))
        continue
      const read = readEntry(entry as any, head as any)
      if (!read.seoMeta)
        continue
      const input = read.input as Record<string, any>
      const meta = (Array.isArray(input.meta) ? input.meta : []) as Record<string, unknown>[]
      const description = meta.find(tag => tag.name === 'description')?.content || meta.find(tag => tag.property === 'og:description')?.content
      if (typeof input.title === 'string')
        result.title = input.title
      if (typeof description === 'string')
        result.description = description
    }
  }
  catch (e) {
    if (import.meta.dev)
      console.warn('[nuxt-og-image] Failed to extract SEO props from head entries', e)
  }
  return result
}

declare module 'nuxt/app' {
  interface NuxtSSRContext {
    _ogImagePayloads?: OgImagePayload[]
    _ogImageInstance?: ActiveHeadEntry<Head>
    _ogImageDevtoolsInstance?: ActiveHeadEntry<Head>
    /** Set by the canonical URLs plugin under compiler mode: makes an og:image URL absolute. */
    _ogImageSiteUrl?: (path: string) => string
  }
}

interface CompiledHead {
  entries: Map<number, { input: unknown }>
  push: (input: unknown, options?: { values?: unknown[] | (() => unknown[]) }) => ActiveHeadEntry<Head>
}

/**
 * The request head, when the build compiled the og:image meta. The build compiles it only under
 * compiler mode, where every head takes compiled tags: the compiled `useHead` calls of the app
 * need that too.
 */
function compiledHead(head: unknown = injectHead()): CompiledHead | undefined {
  return metaShapes && head ? head as CompiledHead : undefined
}

/** Resolved meta, each tag with the options of its entry, as normal input. */
function looseMeta(meta: OgMeta[], mode: keyof typeof OG_META_MODES) {
  return { meta: meta.map(tag => ({ ...tag, ...OG_META_MODES[mode] })) }
}

export function setHeadOgImagePrebuilt(input: OgImagePrebuilt) {
  if (import.meta.client) {
    return
  }
  const url = input.url
  if (!url)
    return
  const { includeTwitter } = useOgImageRuntimeConfig()
  const urlValue = toValue(url)
  const absoluteUrl = /^https?:\/\//.test(urlValue) ? urlValue : toValue(withSiteUrl(urlValue, { withBase: true, canonical: !import.meta.dev }))
  const meta = generateMeta(absoluteUrl, input, { includeTwitter })
  const head = compiledHead()
  if (head) {
    const resolved = meta.map(tag => ({ ...tag, content: toValue(tag.content) }))
    const compiled = compileOgMeta(metaShapes!, 'plain', resolved)
    if (compiled._tag === 'Compiled')
      head.push(compiled.tags, { values: compiled.values })
    else
      head.push(looseMeta(resolved, 'plain'))
    return
  }
  useHead({ meta })
}

/**
 * Pushes the og:image meta of `defineOgImage()` as compiled tags. The payload options decide which
 * tags exist, so the tags are chosen now and their content resolves at the head render, as the
 * lazy `meta()` of the normal entry does. Content the canonical URLs plugin would rewrite is
 * rewritten here. Meta that compiled tags cannot render becomes normal input of the same entry.
 */
function pushCompiledOgMeta(head: CompiledHead, ssrContext: NuxtSSRContext, payloads: OgImagePayload[], resolveMeta: () => ResolvableMeta[]): ActiveHeadEntry<Head> {
  // Placeholder content: the identities only depend on the payload options
  const shape = compileOgMeta(metaShapes!, 'template', payloads.flatMap(([, options]) => generateMeta('x', options).map(tag => ({ ...tag, content: 'x' }))))
  const entry: ActiveHeadEntry<Head> = head.push(shape._tag === 'Compiled' ? shape.tags : [], {
    values: () => {
      const siteUrl = ssrContext._ogImageSiteUrl
      const meta = resolveMeta().map((tag) => {
        const content = toValue(tag.content)
        const image = tag.property === 'og:image' || tag.name === 'twitter:image'
        return { ...tag, content: siteUrl && image && typeof content === 'string' && content && !content.includes('%') ? rewriteImageUrl(content, siteUrl) : content }
      })
      const result = compileOgMeta(metaShapes!, 'template', meta)
      if (shape._tag === 'Compiled' && result._tag === 'Compiled' && result.tags === shape.tags)
        return result.values
      head.entries.get((entry as unknown as { _i: number })._i)!.input = looseMeta(meta, 'template')
      return []
    },
  })
  return entry
}

export function createOgImageMeta(src: string, input: OgImageOptions | OgImagePrebuilt, ssrContext: NuxtSSRContext, pagePath?: string, head?: VueHeadClient) {
  if (import.meta.client) {
    return
  }
  const ogImageConfig = useOgImageRuntimeConfig()
  const { defaults } = ogImageConfig
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

  // Capture config eagerly while Nuxt context is available.
  // The lazy meta() callback runs during unhead tag resolution, where
  // useNuxtApp() / useRuntimeConfig() are no longer accessible.
  const baseURL = useRuntimeConfig().app.baseURL
  const resolveImageUrl = createSitePathResolver({ absolute: true, withBase: true, canonical: !import.meta.dev })

  ssrContext._ogImageInstance?.dispose()
  // Meta is generated lazily so that title/description from useSeoMeta / useHead
  // are available regardless of call ordering (all component setups have completed
  // by the time Unhead resolves tags).
  const resolveMeta = () => {
    const finalPayload = ssrContext._ogImagePayloads || []
    // Extract head SEO props once for all payloads
    const seo = head ? readHeadSeoProps(head) : undefined
    return finalPayload.flatMap(([_, options, payloadBasePath]) => {
      const opts = { ...options, props: { ...options.props } }
      // Resolve component with alias/shorthand support so we know which props it declares.
      // Skips auto-injection for props the component doesn't accept
      // (#573: useHead({ title }) was leaking into URLs of components without a title prop).
      const rawComponentName = opts.component || componentNames?.[0]?.pascalName
      const resolvedComponentName = rawComponentName ? resolveComponentName(rawComponentName) : undefined
      const resolvedComponent = resolvedComponentName
        ? componentNames?.find((c: any) => c.pascalName === resolvedComponentName || c.kebabName === resolvedComponentName)
        : undefined
      const declaredProps: OgImageComponent['propNames'] = resolvedComponent?.propNames
      // Inject title/description from head entries if not explicitly set AND the component declares them
      if (seo) {
        if (seo.title && typeof opts.props.title === 'undefined' && (!declaredProps || declaredProps.includes('title')))
          opts.props.title = seo.title
        if (seo.description && typeof opts.props.description === 'undefined' && (!declaredProps || declaredProps.includes('description')))
          opts.props.description = seo.description
      }
      // Inline getOgImagePath logic: useRuntimeConfig() is unavailable in lazy callbacks
      const extension = opts.extension || defaults?.extension || 'png'
      // Force dynamic+signed URLs even during prerender when strict+secret are set.
      // Otherwise /_og/s/ URLs baked into HTML are unsigned and 403 at runtime for
      // setups where pages are prerendered but OG images are served dynamically.
      const isStatic = import.meta.prerender && !(ogImageConfig.security?.secret && ogImageConfig.security?.strict)
      const urlOpts: Record<string, any> = { ...opts, _path: payloadBasePath }
      // Use a strict (non-aliased) lookup for hash — matches main behavior so URLs
      // stay stable for shorthand component names like `Default` or `NuxtSeo.satori`.
      const componentName = opts.component || componentNames?.[0]?.pascalName
      const component = componentNames?.find((c: any) => c.pascalName === componentName || c.kebabName === componentName)
      if (component?.hash)
        urlOpts._componentHash = component.hash
      const result = buildOgImageUrl(urlOpts, extension, isStatic, defaults, ogImageConfig.security?.secret || undefined)
      // Propagate hash so prerender plugin can store it in prerenderOptionsCache.
      // Must set on both the local copy (opts) AND the original options object,
      // because the payload script serializer reads from the original in
      // ssrContext._ogImagePayloads, not the copy.
      if (result.hash) {
        opts._hash = result.hash
        options._hash = result.hash
      }
      const resolvedUrl = joinURL('/', baseURL, result.url)
      const finalUrl = opts._query && Object.keys(opts._query).length
        ? withQuery(resolvedUrl, { _query: opts._query })
        : resolvedUrl
        // Update prerender paths to match the lazily resolved URL.
        // Only emit for static URLs: dynamic (/_og/d/) URLs are runtime-only and
        // must not be force-prerendered via x-nitro-prerender, because long ones
        // would hit the filesystem 255-byte filename limit when nitro writes them.
      if (isStatic && import.meta.prerender && ssrContext.event) {
        const prerenderPaths: Map<string, string> | undefined = ssrContext.event.context._ogImagePrerenderPaths
        if (prerenderPaths) {
          const ogKey = opts.key || 'og'
          prerenderPaths.set(ogKey, (finalUrl.split('?')[0] || finalUrl).replace(/,/g, '%2C'))
        }
      }
      return generateMeta(toValue(resolveImageUrl(finalUrl)), opts, { includeTwitter: ogImageConfig.includeTwitter })
    })
  }
  const compiled = compiledHead(head)
  ssrContext._ogImageInstance = compiled
    ? pushCompiledOgMeta(compiled, ssrContext, payloads, resolveMeta)
    : useHead({ meta: resolveMeta }, {
        processTemplateParams: true,
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
          const seo = head ? readHeadSeoProps(head) : undefined
          const devtoolsPayload = (ssrContext._ogImagePayloads || []).map(([key, options]) => {
            const payload = resolveUnrefHeadInput(options) as any
            // Resolve component to check declared props before auto-injecting title/description
            const rawComponentName = payload.component || componentNames?.[0]?.pascalName
            const resolvedComponentName = rawComponentName ? resolveComponentName(rawComponentName) : undefined
            const component = resolvedComponentName
              ? componentNames?.find((c: any) => c.pascalName === resolvedComponentName || c.kebabName === resolvedComponentName)
              : undefined
            const declaredProps: OgImageComponent['propNames'] = component?.propNames
            // Use %s template param for title so unhead resolves it with titleTemplate
            if (payload.props && typeof payload.props.title === 'undefined' && (!declaredProps || declaredProps.includes('title')))
              payload.props.title = '%s'
            // Inject description from head entries for devtools/prerender cache
            if (seo?.description && payload.props && typeof payload.props.description === 'undefined' && (!declaredProps || declaredProps.includes('description')))
              payload.props.description = seo.description
            if (typeof payload.component === 'string') {
              payload.component = resolveComponentName(payload.component)
            }
            else if (payload.component) {
              if (import.meta.dev)
                console.warn(`[nuxt-og-image] defineOgImage() received a non-string component value (${typeof payload.component}). Pass the component name as a plain string.`)
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

  const target = head ?? injectHead()
  if (target) {
    markOwnEntry(target, ssrContext._ogImageInstance)
    markOwnEntry(target, ssrContext._ogImageDevtoolsInstance)
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
    // A suffix such as `.takumi` selects that renderer's variant, never a sibling variant
    const requestedRenderer = normalizedName.match(RE_RENDERER_SUFFIX)?.[1]?.toLowerCase()
    for (const component of componentNames) {
      // Exact match with normalized name
      if (component.pascalName === normalizedName)
        return component.pascalName
      if (requestedRenderer && component.renderer !== requestedRenderer)
        continue
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
  const { app, defaults, security } = useOgImageRuntimeConfig()
  const baseURL = app.baseURL
  const extension = _options?.extension || defaults?.extension || 'png'
  // Force dynamic+signed URLs even during prerender when strict+secret are set.
  // Otherwise /_og/s/ URLs baked into HTML are unsigned and 403 at runtime for
  // setups where pages are prerendered but OG images are served dynamically.
  const isStatic = import.meta.prerender && !(security?.secret && security?.strict)
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
  const event = import.meta.server ? useRequestEvent() : undefined
  const c = event ? useRuntimeConfig(event) : useRuntimeConfig()
  // Server-side: full runtime config at the root key.
  // Client-side: the root key is stripped (server-only); only the non-sensitive subset
  // published under `public['nuxt-og-image']` is available. The secret never crosses.
  const serverCfg = (c['nuxt-og-image'] as Record<string, any> | undefined) || {}
  const publicCfg = (c.public?.['nuxt-og-image'] as Record<string, any> | undefined) || {}
  const merged: Record<string, any> = { defaults: {}, ...publicCfg, ...serverCfg }
  const overrideSecret = event?.context._ogImageSigningSecret
  if (overrideSecret)
    merged.security = { ...(merged.security || {}), secret: overrideSecret }
  merged.app = { baseURL: c.app.baseURL }
  return merged as any as OgImageRuntimeConfig
}
