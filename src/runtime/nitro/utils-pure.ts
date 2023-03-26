import type { OgImageOptions } from '../../types'

function decodeHtmlEntities(obj: Record<string, string | any>) {
  Object.entries(obj).forEach(([key, value]) => {
    // unescape all html tokens
    if (typeof value === 'string') {
      obj[key] = value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&#x27;/g, '\'')
        .replace(/&#x2F;/g, '/')
    }
  })
  return obj
}
export function extractOgImageOptions(html: string) {
  // extract the options from our script tag
  const htmlPayload = html.match(/<script id="nuxt-og-image-options" type="application\/json">(.+?)<\/script>/)?.[1]
  if (!htmlPayload)
    return false

  let options: OgImageOptions | false
  try {
    options = JSON.parse(htmlPayload)
  }
  catch (e) {
    options = false
    if (process.dev)
      console.warn('Failed to parse #nuxt-og-image-options', e, options)
  }
  if (options) {
    if (!options.description) {
      // extract the og:description from the html
      const description = html.match(/<meta property="og:description" content="(.*?)">/)?.[1]
      if (description)
        options.description = description
      else
        options.description = html.match(/<meta name="description" content="(.*?)">/)?.[1]
    }
    return decodeHtmlEntities(options)
  }
  return false
}

export function stripOgImageOptions(html: string) {
  return html
    .replace(/<script id="nuxt-og-image-options" type="application\/json">(.*?)<\/script>/, '')
}
