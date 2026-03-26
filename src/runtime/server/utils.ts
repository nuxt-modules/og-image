import type { H3Event } from 'h3'
import type { OgImageComponent, OgImageOptions, OgImageOptionsInternal, OgImageRuntimeConfig } from '../types'
import { componentNames } from '#og-image-virtual/component-names.mjs'
import { useRuntimeConfig } from 'nitropack/runtime'
import { joinURL } from 'ufo'
import { buildOgImageUrl } from '../shared'

export interface GetOgImagePathResult {
  path: string
  hash?: string
}

export function getOgImagePath(_pagePath: string, _options?: Partial<OgImageOptionsInternal>): GetOgImagePathResult {
  const baseURL = useRuntimeConfig().app.baseURL
  const { defaults } = useOgImageRuntimeConfig()
  const extension = _options?.extension || defaults.extension
  const isStatic = import.meta.prerender
  const options: Record<string, any> = { ..._options, _path: _pagePath }
  // Include the component template hash so that template changes produce different URLs,
  // busting CDN/build caches (Vercel, social platform crawlers like Twitter/Facebook, etc.)
  const componentName = _options?.component || (componentNames as OgImageComponent[])?.[0]?.pascalName
  const component = (componentNames as OgImageComponent[])?.find(c => c.pascalName === componentName || c.kebabName === componentName)
  if (component?.hash)
    options._componentHash = component.hash
  // Include _path so the server knows which page to render
  // Pass defaults to skip encoding default values in URL
  const result = buildOgImageUrl(options, extension, isStatic, defaults)
  return {
    path: joinURL('/', baseURL, result.url),
    hash: result.hash,
  }
}

export function useOgImageRuntimeConfig(e?: H3Event) {
  const c = useRuntimeConfig(e)
  return {
    defaults: {},
    ...(c['nuxt-og-image'] as Record<string, any>),
    app: {
      baseURL: c.app.baseURL,
    },
  } as any as OgImageRuntimeConfig
}
