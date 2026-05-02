import type { H3Event } from 'h3'
import type { OgImageComponent, OgImageOptionsInternal, OgImageRuntimeConfig } from '../types'
import { useRuntimeConfig } from 'nitropack/runtime'
import { joinURL } from 'ufo'
import { componentNames } from '#og-image-virtual/component-names.mjs'
import { buildOgImageUrl } from '../shared'

export interface GetOgImagePathResult {
  path: string
  hash?: string
}

export function getOgImagePath(_pagePath: string, _options?: Partial<OgImageOptionsInternal>): GetOgImagePathResult {
  const baseURL = useRuntimeConfig().app.baseURL
  const { defaults, security } = useOgImageRuntimeConfig()
  const extension = _options?.extension || defaults.extension
  // Force dynamic+signed URLs even during prerender when strict+secret are set.
  // Otherwise /_og/s/ URLs baked into HTML are unsigned and 403 at runtime for
  // setups where pages are prerendered but OG images are served dynamically.
  const isStatic = import.meta.prerender && !(security?.secret && security?.strict)
  const options: Record<string, any> = { ..._options, _path: _pagePath }
  // Include the component template hash so that template changes produce different URLs,
  // busting CDN/build caches (Vercel, social platform crawlers like Twitter/Facebook, etc.)
  const componentName = _options?.component || (componentNames as OgImageComponent[])?.[0]?.pascalName
  const component = (componentNames as OgImageComponent[])?.find(c => c.pascalName === componentName || c.kebabName === componentName)
  if (component?.hash)
    options._componentHash = component.hash
  // Include _path so the server knows which page to render
  // Pass defaults to skip encoding default values in URL
  const result = buildOgImageUrl(options, extension, isStatic, defaults, security?.secret || undefined)
  return {
    path: joinURL('/', baseURL, result.url),
    hash: result.hash,
  }
}

export function useOgImageRuntimeConfig(e?: H3Event) {
  const c = useRuntimeConfig(e)
  const moduleCfg = (c['nuxt-og-image'] as Record<string, any> | undefined) || {}
  const cloudflareEnv = e?.context.cloudflare?.env || (e?.context as any)?._platform?.cloudflare?.env
  // Top-level `ogImage.secret` is populated by Nuxt's standard env override
  // (`NUXT_OG_IMAGE_SECRET`) and takes precedence over the build-time
  // `security.secret` so deployments can rotate the secret without rebuilding.
  // Passing the event matters on platforms like Cloudflare Workers where env
  // bindings are only resolved when an event is available.
  const overrideSecret = (
    (c as Record<string, any>).ogImage?.secret
    || cloudflareEnv?.NUXT_OG_IMAGE_SECRET
  ) as string | undefined
  const security = overrideSecret
    ? { ...(moduleCfg.security || {}), secret: overrideSecret }
    : moduleCfg.security
  return {
    defaults: {},
    ...moduleCfg,
    security,
    app: {
      baseURL: c.app.baseURL,
    },
  } as any as OgImageRuntimeConfig
}
