import type { Head } from '@unhead/schema'
import type { OgImageOptions, OgImageRuntimeConfig } from './types'
import { useRuntimeConfig } from '#imports'
import { defu } from 'defu'
import { joinURL, withQuery } from 'ufo'
import { getExtension } from './pure'

// must work in both Nuxt an

export * from './pure'

export function generateMeta(url: string, resolvedOptions: OgImageOptions) {
  let urlExtension = getExtension(url) || resolvedOptions.extension
  if (urlExtension === 'jpg')
    urlExtension = 'jpeg'
  const meta: Head['meta'] = [
    { property: 'og:image', content: url },
    { property: 'og:image:type', content: `image/${urlExtension}` },
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
  const options = defu(_options, useOgImageRuntimeConfig().defaults)
  const path = joinURL('/', baseURL, `__og-image__/${import.meta.prerender ? 'static' : 'image'}`, pagePath, `og.${options.extension}`)
  if (Object.keys(options._query || {}).length) {
    return withQuery(path, options._query)
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
