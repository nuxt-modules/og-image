import { defu } from 'defu'
import type { OgImageOptions } from './types'

export function isInternalRoute(path: string) {
  const lastSegment = path.split('/').pop() || path
  return lastSegment.includes('.') || path.startsWith('/__') || path.startsWith('@')
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
    'satori',
    'resvg',
    'sharp',
    'screenshot',
    'cacheMaxAgeSeconds',
    'componentHash',
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
