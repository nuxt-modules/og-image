import { defu } from 'defu'
import type { InputFontConfig, OgImageOptions, ResolvedFontConfig } from './types'

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
    'fonts',
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

export function normaliseFontInput(fonts: InputFontConfig[]): ResolvedFontConfig[] {
  return fonts.map((f) => {
    if (typeof f === 'string') {
      const [name, weight] = f.split(':')
      return <ResolvedFontConfig> {
        cacheKey: f,
        name,
        weight: weight || '400',
        style: 'normal',
        path: undefined,
      }
    }
    return <ResolvedFontConfig> {
      cacheKey: f.key || `${f.name}:${f.weight}`,
      style: 'normal',
      weight: 400,
      ...f,
    }
  })
}

export function withoutQuery(path: string) {
  return path.split('?')[0]
}

export function getExtension(path: string) {
  path = withoutQuery(path)
  const lastSegment = (path.split('/').pop() || path)
  return lastSegment.split('.').pop() || lastSegment
}
