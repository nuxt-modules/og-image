import type { DevToolsMetaDataExtraction } from './types'

export function extractSocialPreviewTags(html: string): [Record<string, string>, DevToolsMetaDataExtraction[]] {
  // we need to extract the social media tag data for description and title, allow property to be before and after
  const data: Partial<DevToolsMetaDataExtraction>[] = []
  const rootData: Record<string, string> = {}
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
    if (!data[currentArrayIdx]![type])
      data[currentArrayIdx]![type] = {}
    data[currentArrayIdx]![type]![key] = value
  })
  // for each group we need to extract the key from the og:image URL
  // New URL format: /_og/d/w_1200,k_twitter,title_Hello.png
  // Key is encoded as k_<value> in the URL path
  data.forEach((preview) => {
    if (preview.og?.image && preview.og?.image.includes('/_og/')) {
      const url = withoutQuery(preview.og.image)!
      // Extract key from encoded params (k_<value>)
      const keyMatch = url.match(/[,/]k_([^,./]+)/)
      preview.key = keyMatch?.[1] || 'og'
    }
  })
  return [rootData, data as DevToolsMetaDataExtraction[]]
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

export function withoutQuery(path: string) {
  return path.split('?')[0]
}

export function getExtension(path: string) {
  path = withoutQuery(path)!
  const lastSegment = (path.split('/').pop() || path)
  return lastSegment.split('.').pop() || lastSegment
}
