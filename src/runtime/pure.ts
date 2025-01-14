import type { InputFontConfig, OgImageOptions, ResolvedFontConfig } from './types'
import { defu } from 'defu'

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

// duplicate of ../pure.ts
export function normaliseFontInput(fonts: InputFontConfig[]): ResolvedFontConfig[] {
  return fonts.map((f) => {
    if (typeof f === 'string') {
      const vals = f.split(':')
      const includesStyle = vals.length === 3
      let name, weight, style
      if (includesStyle) {
        name = vals[0]
        style = vals[1]
        weight = vals[2]
      }
      else {
        name = vals[0]
        weight = vals[1]
      }
      return <ResolvedFontConfig> {
        cacheKey: f,
        name,
        weight: weight || 400,
        style: style || 'normal',
        path: undefined,
      }
    }
    return <ResolvedFontConfig> {
      cacheKey: f.key || `${f.name}:${f.style}:${f.weight}`,
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
