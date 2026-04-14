import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { DefineOgImageInput, OgImageOptions, OgImageOptionsInternal, OgImagePrebuilt } from '../types'
import { componentNames } from '#build/nuxt-og-image/components.mjs'
import { defu } from 'defu'
import { useHead, useRuntimeConfig } from 'nuxt/app'
import { joinURL, withQuery } from 'ufo'
import { toValue } from 'vue'
import { buildOgImageUrl, generateMeta, separateProps } from '../shared'

/**
 * Client-only helpers used by `defineOgImage` during SPA navigation. Lives in its
 * own file (separate from `./utils`) so the client bundle doesn't transitively
 * pull in server-only modules like `consola` via the shared logger import. The
 * server path keeps using `./utils` which retains those richer imports.
 */

function resolveReactiveOptions(input: DefineOgImageInput): OgImageOptions | OgImagePrebuilt | false {
  const options = toValue(input)
  if (options === false)
    return false
  const opts = options as OgImageOptions | OgImagePrebuilt
  if (opts.width)
    opts.width = toValue(opts.width)
  if (opts.height)
    opts.height = toValue(opts.height)
  if (opts.alt)
    opts.alt = toValue(opts.alt)
  if (opts.url)
    opts.url = toValue(opts.url)
  if (opts.props) {
    opts.props = { ...opts.props }
    for (const key in opts.props) {
      opts.props[key] = toValue(opts.props[key])
    }
  }
  return opts
}

/**
 * Build a `/_og/r/<path>` resolver URL. The resolver re-fetches the target page
 * server-side and 302-redirects to whatever og:image it emits, so it matches the
 * SSR URL exactly (including useSeoMeta-injected titles and HMAC-signed strict
 * URLs) without ever exposing the signing secret to the client.
 *
 * Current-route query params are forwarded to the resolver, which in turn forwards
 * them to the page fetch. Pages whose og:image varies by query (e.g. `?lang=fr`)
 * therefore get the right variant on SPA navigation.
 */
function buildResolverUrl(
  baseURL: string,
  basePath: string,
  ogKey: string,
  query: Record<string, any> | undefined,
): string {
  // `.png` is cosmetic: the resolver strips it before looking up the real og:image,
  // but having an extension keeps the URL well-formed for consumers.
  const resolverUrl = `${joinURL('/', baseURL, '_og/r', basePath)}.png`
  const queryObj: Record<string, any> = {}
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      // Resolver reserves `_og_*` params for itself (e.g. `_og_key`); drop any
      // user-supplied params of that shape so they don't collide.
      if (!k.startsWith('_og_'))
        queryObj[k] = v
    }
  }
  if (ogKey === 'twitter')
    queryObj._og_key = 'twitter'
  return Object.keys(queryObj).length ? withQuery(resolverUrl, queryObj) : resolverUrl
}

/**
 * Client-side processing for SPA navigations: registers a `useHead` entry pointing
 * at the correct og:image URL for the current route so iOS share sheet, devtools
 * and any other DOM reader see the current page's image instead of the initial
 * page's (#567).
 *
 * Strategy by deployment:
 *  - SSR (any flavour): point at the `/_og/r/<path>` resolver. Re-fetches the
 *    target page server-side and redirects to whatever og:image SSR emits, so the
 *    client URL always matches the server's (including useSeoMeta-injected titles
 *    and strict HMAC-signed URLs, without exposing the secret).
 *  - Pure SSG (no runtime server): rebuild the URL directly from defaults. If the
 *    page relies on useSeoMeta auto-injection the rebuilt URL won't include those
 *    values; the resolver can't help without a server.
 */
export function clientProcessOgImageOptions(
  input: DefineOgImageInput | DefineOgImageInput[],
  route: RouteLocationNormalizedLoaded,
  basePath: string,
): string[] {
  const inputs = Array.isArray(input) ? input : [input]
  const rc = useRuntimeConfig()
  const baseURL = rc.app.baseURL
  const publicCfg = (rc.public?.['nuxt-og-image'] as { defaults?: Record<string, any>, hasServerRuntime?: boolean } | undefined) || {}
  const defaults = publicCfg.defaults || {}
  const paths: string[] = []

  for (const rawInput of inputs) {
    const resolved = resolveReactiveOptions(rawInput)
    if (resolved === false)
      continue
    const validOptions = resolved as OgImageOptions | OgImagePrebuilt

    for (const key in defaults) {
      // @ts-expect-error untyped
      if (validOptions[key] === undefined)
        // @ts-expect-error untyped
        validOptions[key] = defaults[key]
    }

    if (route.query)
      (validOptions as OgImageOptionsInternal)._query = route.query

    // Prebuilt URL override: user pointed at a specific URL, use it directly.
    if ((validOptions as OgImagePrebuilt).url) {
      const url = (validOptions as OgImagePrebuilt).url as string
      useHead({ meta: generateMeta(url, validOptions) }, { tagPriority: 'high' })
      paths.push(url)
      continue
    }

    // SSR: route through the resolver for a guaranteed match with the server URL.
    if (publicCfg.hasServerRuntime) {
      const ogKey = (validOptions as OgImageOptions).key || 'og'
      const finalUrl = buildResolverUrl(baseURL, basePath, ogKey, route.query as Record<string, any> | undefined)
      useHead({ meta: generateMeta(finalUrl, validOptions) }, { tagPriority: 35 })
      paths.push(finalUrl)
      continue
    }

    // Pure SSG: rebuild the static /_og/s/ URL locally. Matches the prerendered
    // file as long as options line up with what SSR emitted.
    const opts = separateProps(defu(validOptions, defaults)) as OgImageOptionsInternal
    const extension = opts.extension || defaults?.extension || 'png'
    const urlOpts: Record<string, any> = { ...opts, _path: basePath }
    const componentName = opts.component || componentNames?.[0]?.pascalName
    const component = componentNames?.find((c: any) => c.pascalName === componentName || c.kebabName === componentName)
    if (component?.hash)
      urlOpts._componentHash = component.hash
    const result = buildOgImageUrl(urlOpts, extension, true, defaults, undefined)
    const resolvedUrl = joinURL('/', baseURL, result.url)
    const finalUrl = opts._query && Object.keys(opts._query).length
      ? withQuery(resolvedUrl, { _query: opts._query })
      : resolvedUrl
    useHead({ meta: generateMeta(finalUrl, opts) }, { processTemplateParams: true, tagPriority: 35 })
    paths.push(finalUrl)
  }

  return paths
}
