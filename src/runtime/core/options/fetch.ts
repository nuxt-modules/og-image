import { type H3Error, type H3Event, createError } from 'h3'
import type { OgImageOptions } from '../../types'
import { extractAndNormaliseOgImageOptions } from './extract'

// TODO caching
export async function fetchPathHtmlAndExtractOptions(e: H3Event, path: string): Promise<H3Error | OgImageOptions> {
  // extract the payload from the original path
  let html: string
  try {
    html = await e.$fetch(path)
  }
  catch (err) {
    return createError({
      statusCode: 500,
      statusMessage: `Failed to read the path ${path} for og-image extraction. ${err.message}.`,
    })
  }

  const payload = extractAndNormaliseOgImageOptions(html!)
  // not supported
  if (!payload) {
    return createError({
      statusCode: 400,
      statusMessage: `The path is missing the Nuxt OG Image payload. Did you forget to use defineOgImage()?`,
    })
  }

  // need to hackily reset the event params so we can access the route rules of the base URL
  return payload
}
