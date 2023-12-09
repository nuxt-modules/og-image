import { type H3Error, type H3Event, createError } from 'h3'
import type { OgImageOptions } from '../../types'
import { htmlPayloadCache } from '../cache/htmlPayload'
import { extractAndNormaliseOgImageOptions } from './extract'

// TODO caching
export async function fetchPathHtmlAndExtractOptions(e: H3Event, path: string, key: string): Promise<H3Error | OgImageOptions> {
  const cachedHtmlPayload = await htmlPayloadCache.getItem(key)
  if (cachedHtmlPayload && cachedHtmlPayload.expiresAt < Date.now())
    return cachedHtmlPayload.value

  // extract the payload from the original path
  let html: unknown
  try {
    html = await e.$fetch(path)
  }
  catch (err) {
    return createError({
      statusCode: 500,
      statusMessage: `[Nuxt OG Image] Failed to read the path ${path} for og-image extraction. ${err.message}.`,
    })
  }

  if (typeof html !== 'string') {
    return createError({
      statusCode: 500,
      statusMessage: `[Nuxt OG Image] Got invalid response from ${path} for og-image extraction.`,
    })
  }

  // need to hackily reset the event params, so we can access the route rules of the base URL
  const payload = extractAndNormaliseOgImageOptions(html!)
  if (payload) {
    await htmlPayloadCache.setItem(key, {
      // 60 minutes for prerender, 10 seconds for runtime
      expiresAt: Date.now() + (1000 * (import.meta.prerender ? 60 * 60 : 10)),
      value: payload,
    })
  }
  return payload
}
