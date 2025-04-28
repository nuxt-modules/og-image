import type { ResolvableMeta } from '@unhead/vue'
import type { OgImageOptions, OgImagePrebuilt, OgImageRuntimeConfig } from './types'
import { useRuntimeConfig } from '#imports'
import { joinURL, withQuery } from 'ufo'
import { toValue } from 'vue'
import { getExtension } from './pure'

// must work in both Nuxt an

export * from './pure'

export function generateMeta(url: OgImagePrebuilt['url'] | string, resolvedOptions: OgImageOptions | OgImagePrebuilt): ResolvableMeta[] {
  const meta: ResolvableMeta[] = [
    { property: 'og:image', content: url },
    { property: 'og:image:type', content: () => `image/${getExtension(toValue(url)) || resolvedOptions.extension}` },
    { name: 'twitter:card', content: 'summary_large_image' },
    // we don't need this but avoids issue when using useSeoMeta({ twitterImage })
    { name: 'twitter:image', content: url },
    { name: 'twitter:image:src', content: url },
  ]
  if (resolvedOptions.width) {
    meta.push({ property: 'og:image:width', content: resolvedOptions.width })
    meta.push({ name: 'twitter:image:width', content: resolvedOptions.width })
  }
  if (resolvedOptions.height) {
    meta.push({ property: 'og:image:height', content: resolvedOptions.height })
    meta.push({ name: 'twitter:image:height', content: resolvedOptions.height })
  }
  if (resolvedOptions.alt) {
    meta.push({ property: 'og:image:alt', content: resolvedOptions.alt })
    meta.push({ name: 'twitter:image:alt', content: resolvedOptions.alt })
  }
  return meta
}

export function getOgImagePath(pagePath: string, _options?: Partial<OgImageOptions>) {
  const baseURL = useRuntimeConfig().app.baseURL
  const extension = _options?.extension || useOgImageRuntimeConfig().defaults.extension
  const path = joinURL('/', baseURL, `__og-image__/${import.meta.prerender ? 'static' : 'image'}`, pagePath, `og.${extension}`)
  if (Object.keys(_options?._query || {}).length) {
    return withQuery(path, _options!._query!)
  }
  return path
}

export function useOgImageRuntimeConfig() {
  const c = useRuntimeConfig()
  return {
    ...(c['nuxt-og-image'] as Record<string, any>),
    app: {
      baseURL: c.app.baseURL,
    },
  } as any as OgImageRuntimeConfig
}
