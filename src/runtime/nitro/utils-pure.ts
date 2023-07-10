import { defu } from 'defu'
import type { OgImageOptions, RuntimeOgImageOptions } from '../types'

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
export function extractAndNormaliseOgImageOptions(path: string, html: string, routeRules: OgImageOptions, defaults: OgImageOptions): OgImageOptions | false {
  // extract the options from our script tag
  const htmlPayload = html.match(/<script id="nuxt-og-image-options" type="application\/json">(.+?)<\/script>/)?.[1]
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
    options = defu(payload, routeRules)
  }
  catch (e) {
    options = routeRules
    if (process.dev)
      console.warn('Failed to parse #nuxt-og-image-options', e, options)
  }
  if (!options)
    return false

  if (!options.description) {
    // extract the og:description from the html
    const description = html.match(/<meta property="og:description" content="(.*?)">/)?.[1]
    if (description)
      options.description = description
    else
      options.description = html.match(/<meta name="description" content="(.*?)">/)?.[1]
  }
  const decoded = decodeObjectHtmlEntities(options)
  return defu(
    decoded,
    // runtime options
    { path },
    defaults,
  ) as RuntimeOgImageOptions
}
