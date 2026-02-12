import type { ResolvableMeta } from '@unhead/vue'
import type { OgImageOptions, OgImagePrebuilt } from './types'
import { defu } from 'defu'
import { toValue } from 'vue'

export { extractSocialPreviewTags, toBase64Image } from './pure'
export { buildOgImageUrl, decodeOgImageParams, encodeOgImageParams, hashOgImageOptions, parseOgImageUrl } from './shared/urlEncoding'

export function generateMeta(url: OgImagePrebuilt['url'] | string, resolvedOptions: OgImageOptions | OgImagePrebuilt): ResolvableMeta[] {
  const key = resolvedOptions.key || 'og'
  const isTwitterOnly = key === 'twitter'
  const includeTwitter = key === 'og' || key === 'twitter'

  const meta: ResolvableMeta[] = []

  if (!isTwitterOnly) {
    meta.push({ property: 'og:image', content: url })
    meta.push({ property: 'og:image:type', content: () => `image/${getExtension(toValue(url) as string) || resolvedOptions.extension}` })
  }

  if (includeTwitter) {
    meta.push({ name: 'twitter:card', content: 'summary_large_image' })
    meta.push({ name: 'twitter:image', content: url })
    meta.push({ name: 'twitter:image:src', content: url })
  }

  if (resolvedOptions.width) {
    if (!isTwitterOnly)
      meta.push({ property: 'og:image:width', content: resolvedOptions.width })
    if (includeTwitter)
      meta.push({ name: 'twitter:image:width', content: resolvedOptions.width })
  }
  if (resolvedOptions.height) {
    if (!isTwitterOnly)
      meta.push({ property: 'og:image:height', content: resolvedOptions.height })
    if (includeTwitter)
      meta.push({ name: 'twitter:image:height', content: resolvedOptions.height })
  }
  if (resolvedOptions.alt) {
    if (!isTwitterOnly)
      meta.push({ property: 'og:image:alt', content: resolvedOptions.alt })
    if (includeTwitter)
      meta.push({ name: 'twitter:image:alt', content: resolvedOptions.alt })
  }
  return meta
}

export function isInternalRoute(path: string) {
  return path.startsWith('/_') || path.startsWith('@')
}

function filterIsOgImageOption(key: string) {
  const keys: (keyof OgImageOptions)[] = [
    'url',
    'extension',
    'width',
    'height',
    'alt',
    'props',
    'renderer', // internal use only (screenshots)
    'html',
    'component',
    'emojis',
    '_query',
    '_hash',
    'fonts',
    'satori',
    'resvg',
    'sharp',
    'screenshot',
    'cacheMaxAgeSeconds',
    'key',
  ]
  return keys.includes(key as keyof OgImageOptions)
}

export function separateProps(options: OgImageOptions | undefined, ignoreKeys: string[] = []): OgImageOptions {
  options = options || {}
  const _props = defu(options.props as Record<string, any>, Object.fromEntries(
    Object.entries({ ...options })
      .filter(([k]) => !filterIsOgImageOption(k) && !ignoreKeys.includes(k)),
  ))
  // need to make sure all props are camelCased
  const props: Record<string, any> = {}
  Object.entries(_props)
    .forEach(([key, val]) => {
      // with a simple kebab case conversion
      props[key.replace(/-([a-z])/g, g => String(g[1]).toUpperCase())] = val
    })
  const result: Record<string, any> = Object.fromEntries(
    Object.entries({ ...options })
      .filter(([k]) => filterIsOgImageOption(k) || ignoreKeys.includes(k)),
  )
  if (Object.keys(props).length > 0)
    result.props = props
  return result as OgImageOptions
}

export function withoutQuery(path: string) {
  return path.split('?')[0]
}

export function getExtension(path: string) {
  path = withoutQuery(path)!
  const lastSegment = (path.split('/').pop() || path)
  const extension = lastSegment.split('.').pop() || lastSegment
  if (extension === 'jpg')
    return 'jpeg'
  return extension
}
