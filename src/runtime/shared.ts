import type { ResolvableMeta } from '@unhead/vue'
import type { OgImageOptions, OgImagePrebuilt } from './types'
import { defu } from 'defu'
import { toValue } from 'vue'

export function generateMeta(url: OgImagePrebuilt['url'] | string, resolvedOptions: OgImageOptions | OgImagePrebuilt): ResolvableMeta[] {
  const meta: ResolvableMeta[] = [
    { property: 'og:image', content: url },
    { property: 'og:image:type', content: () => `image/${getExtension(toValue(url) as string) || resolvedOptions.extension}` },
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

function detectBase64MimeType(data: string) {
  const signatures = {
    'R0lGODdh': 'image/gif',
    'R0lGODlh': 'image/gif',
    'iVBORw0KGgo': 'image/png',
    '/9j/': 'image/jpeg',
    'UklGR': 'image/webp',
    'AAABAA': 'image/x-icon',
  }

  for (const s in signatures) {
    if (data.startsWith(s)) {
      return signatures[s as keyof typeof signatures]
    }
  }
  return 'image/svg+xml'
}

export function toBase64Image(data: string | ArrayBuffer) {
  const base64 = typeof data === 'string' ? data : Buffer.from(data).toString('base64')
  const type = detectBase64MimeType(base64)
  return `data:${type};base64,${base64}`
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
    'renderer',
    'html',
    'component',
    'renderer',
    'emojis',
    '_query',
    'satori',
    'resvg',
    'sharp',
    'screenshot',
    'cacheMaxAgeSeconds',
  ]
  return keys.includes(key as keyof OgImageOptions)
}

export function separateProps(options: OgImageOptions | undefined, ignoreKeys: string[] = []) {
  options = options || {}
  const _props = defu(options.props, Object.fromEntries(
    Object.entries({ ...options })
      .filter(([k]) => !filterIsOgImageOption(k) && !ignoreKeys.includes(k)),
  ))
  // need to make sure all props are camelCased
  const props: Record<string, any> = {}
  Object.entries(_props)
    .forEach(([key, val]) => {
      // with a simple kebab case conversion
      props[key.replace(/-([a-z])/g, g => g[1].toUpperCase())] = val
    })
  return {
    ...Object.fromEntries(
      Object.entries({ ...options })
        .filter(([k]) => filterIsOgImageOption(k) || ignoreKeys.includes(k)),
    ),
    props,
  }
}

export function withoutQuery(path: string) {
  return path.split('?')[0]
}

export function getExtension(path: string) {
  path = withoutQuery(path)
  const lastSegment = (path.split('/').pop() || path)
  const extension = lastSegment.split('.').pop() || lastSegment
  if (extension === 'jpg')
    return 'jpeg'
  return extension
}

/**
 * @deprecated Please use `#og-image/app/utils` instead.
 */
export function useOgImageRuntimeConfig() {
  return {}
}
