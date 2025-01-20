import type { DevToolsMetaDataExtraction, InputFontConfig, OgImageOptions, ResolvedFontConfig } from './types'
import { defu } from 'defu'

export function extractSocialPreviewTags(html: string): [Record<string, string>, DevToolsMetaDataExtraction[]] {
  // we need to extract the social media tag data for description and title, allow property to be before and after
  const data: DevToolsMetaDataExtraction[] = []
  const rootData = {}
  // support both property and name
  const socialMetaTags = html.match(/<meta[^>]+(property|name)="(twitter|og):([^"]+)"[^>]*>/g) || []
  // <meta property="og:title" content="Home & //<&quot;With Encoding&quot;>\\"
  // we need to group the tags into the array, we add a new array entry when a new url is found
  let currentArrayIdx = -1
  socialMetaTags.forEach((tag) => {
    const [, , type, key] = tag.match(/(property|name)="(twitter|og):([^"]+)"/) as any as [undefined, undefined, 'twitter' | 'og', string]
    const value = tag.match(/content="([^"]+)"/)?.[1]
    if (!value) {
      return
    }
    if (key === 'title' || key === 'description') {
      rootData[`${type}:${key}`] = value
      return
    }
    if (type === 'og' && key === 'image') {
      currentArrayIdx++
    }
    // start adding to the array
    if (!data[currentArrayIdx])
      data[currentArrayIdx] = {}
    if (!data[currentArrayIdx][type])
      data[currentArrayIdx][type] = {}
    data[currentArrayIdx][type]![key] = value
  })
  // for each group we need to compute the key value from the og:image file name without an extension
  data.forEach((preview) => {
    if (preview.og?.image && preview.og?.image.includes('/_og/d/')) {
      preview.key = (withoutQuery(preview.og.image).split('/').pop() as string).replace(/\.\w+$/, '')
    }
  })
  return [rootData, data]
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
    if (data.indexOf(s) === 0)
      return signatures[s as keyof typeof signatures]
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
    'key',
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
      const [name, weight] = f.split(':')
      return <ResolvedFontConfig> {
        cacheKey: f,
        name,
        weight: weight || 400,
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
