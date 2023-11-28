import type { OgImageOptions, RuntimeOgImageOptions } from '../../types'

export function decodeHtml(html: string) {
  return html.replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    // money symbols
    .replace(/&cent;/g, '¢')
    .replace(/&pound;/g, '£')
    .replace(/&yen;/g, '¥')
    .replace(/&euro;/g, '€')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&#x27;/g, '\'')
    .replace(/&#x2F;/g, '/')
    .replace(/&#([0-9]+);/g, (full, int) => {
      return String.fromCharCode(Number.parseInt(int))
    })
}
function decodeObjectHtmlEntities(obj: Record<string, string | any>) {
  Object.entries(obj).forEach(([key, value]) => {
    // unescape all html tokens
    if (typeof value === 'string')
      obj[key] = decodeHtml(value)
  })
  return obj
}
export function extractAndNormaliseOgImageOptions(html: string): OgImageOptions | false {
  // extract the options from our script tag
  const htmlPayload = html.match(/<script.+id="nuxt-og-image-options"[^>]*>(.+?)<\/script>/)?.[1]
  if (!htmlPayload)
    return false

  let options: OgImageOptions | false
  try {
    const payload = JSON.parse(htmlPayload)
    // remove empty values, allow route rules to override, these comes from template param values like title
    Object.entries(payload).forEach(([key, value]) => {
      if (!value)
        delete payload[key]
    })
    options = payload // defu(payload, routeRules)
  }
  catch (e) {
    // options = routeRules
    if (import.meta.dev)
      console.warn('Failed to parse #nuxt-og-image-options', e, options)
  }
  if (!options)
    return false

  const payload = decodeObjectHtmlEntities(options) as RuntimeOgImageOptions

  // only needed for nuxt dev tools
  if (import.meta.dev) {
  // we need to extract the social media tag data for description and title, allow property to be before and after
    const socialPreview: { twitter?: Record<string, string>, og?: Record<string, string> } = {}

    // support both property and name
    const socialMetaTags = html.match(/<meta[^>]+(property|name)="(twitter|og):([^"]+)"[^>]*>/g)
    // <meta property="og:title" content="Home & //<&quot;With Encoding&quot;>\\"
    if (socialMetaTags) {
      socialMetaTags.forEach((tag) => {
        const [, , type, key] = tag.match(/(property|name)="(twitter|og):([^"]+)"/) as any as [undefined, undefined, 'twitter' | 'og', string]
        const value = tag.match(/content="([^"]+)"/)?.[1]
        if (!value)
          return
        if (!socialPreview[type])
          socialPreview[type] = {}
        socialPreview[type]![key] = value
      })
    }
    payload.socialPreview = socialPreview
  }
  return payload
}
