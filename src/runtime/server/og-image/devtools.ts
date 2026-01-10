import type { DevToolsMetaDataExtraction, OgImageOptions } from '#og-image/types'
import type { H3Error, H3Event } from 'h3'
import { htmlPayloadCache } from '#og-image-cache'
import { extractSocialPreviewTags } from '#og-image/pure'
import { logger } from '#og-image/server/util/logger'
import { parse } from 'devalue'
import { createError } from 'h3'

export interface DevToolsExtractPayload {
  options: OgImageOptions[]
  socialPreview: {
    root: Record<string, string>
    images: DevToolsMetaDataExtraction[]
  }
}

const PAYLOAD_REGEX = /<script.+id="nuxt-og-image-options"[^>]*>(.+?)<\/script>/

function extractOptionsFromHtml(html: string): OgImageOptions[] {
  const match = String(html).match(PAYLOAD_REGEX)
  if (!match?.[1])
    return []
  return parse(match[1]) as OgImageOptions[]
}

async function doFetchWithErrorHandling(fetch: any, path: string) {
  const res = await fetch(path, {
    redirect: 'follow',
    headers: {
      accept: 'text/html',
    },
  })
    .catch((err: any) => {
      return err
    })
  let errorDescription
  // if its a redirect let's get the redirect path
  if (res.status >= 300 && res.status < 400) {
    // follow valid redirects
    if (res.headers.has('location')) {
      return await doFetchWithErrorHandling(fetch, res.headers.get('location') || '')
    }
    errorDescription = `${res.status} redirected to ${res.headers.get('location') || 'unknown'}`
  }
  else if (res.status >= 400) {
    // try get the error message from the response
    errorDescription = `${res.status} error: ${res.statusText}`
  }
  if (errorDescription) {
    return [null, createError({
      statusCode: 500,
      statusMessage: `[Nuxt OG Image] Failed to parse \`${path}\` for og-image extraction. ${errorDescription}`,
    })]
  }
  return [res._data || await res.text(), null]
}

// this is only needed by devtools
export async function fetchPathHtmlAndExtractOptions(e: H3Event, path: string, cacheKey: string): Promise<H3Error | DevToolsExtractPayload> {
  const cachedHtmlPayload = await htmlPayloadCache.getItem(cacheKey) as { expiresAt: number, value: DevToolsExtractPayload } | null
  if (!import.meta.dev && cachedHtmlPayload && cachedHtmlPayload.expiresAt > Date.now())
    return cachedHtmlPayload.value

  // extract the payload from the original path
  let [html, err] = await doFetchWithErrorHandling(e.fetch, path)
  if (err) {
    logger.warn(err)
  }
  // fallback to globalThis.fetch
  if (!html) {
    const [fallbackHtml, err] = await doFetchWithErrorHandling(globalThis.$fetch.raw, path)
    if (err) {
      return err
    }
    html = fallbackHtml
  }

  if (!html) {
    return createError({
      statusCode: 500,
      statusMessage: `[Nuxt OG Image] Failed to read the path ${path} for og-image extraction, returning no HTML.`,
    })
  }

  // Extract social preview tags from meta tags and options from script tag
  const [root, images] = extractSocialPreviewTags(html)
  const options = extractOptionsFromHtml(html)

  const payload: DevToolsExtractPayload = {
    options,
    socialPreview: { root, images },
  }

  if (!import.meta.dev && payload) {
    await htmlPayloadCache.setItem(cacheKey, {
      // 60 minutes for prerender, 10 seconds for runtime
      expiresAt: Date.now() + (1000 * (import.meta.prerender ? 60 * 60 : 10)),
      value: payload as any,
    })
  }
  return payload
}
