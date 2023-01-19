import { parseURL, withoutTrailingSlash } from 'ufo'
import { defineEventHandler, getQuery } from 'h3'
import type { OgImagePayload } from '../../../../types'
import { PayloadScriptId } from '#nuxt-og-image/constants'
import { getRouteRules, useRuntimeConfig } from '#internal/nitro'

export const extractOgPayload = (html: string) => {
  // extract the payload from our script tag
  const payload = html.match(new RegExp(`<script id="${PayloadScriptId}" type="application/json">(.+?)</script>`))?.[1]
  if (payload) {
    // convert html encoded characters to utf8
    return JSON.parse(payload)
  }
  return false
}

export const inferOgPayload = (html: string) => {
  const payload: Record<string, any> = {}
  // extract the og:title from the html
  const title = html.match(/<meta property="og:title" content="(.*?)">/)?.[1]
  if (title)
    payload.title = title

  // extract the og:description from the html
  const description = html.match(/<meta property="og:description" content="(.*?)">/)?.[1]
  if (description)
    payload.description = description
  return payload
}

export default defineEventHandler(async (e) => {
  const path = parseURL(e.path).pathname
  if (!path.endsWith('__og_image__/payload'))
    return

  const basePath = withoutTrailingSlash(path.replace('__og_image__/payload', ''))
  // extract the payload from the original path
  const html = await $fetch<string>(basePath)

  const extractedPayload = extractOgPayload(html)
  // not supported
  if (!extractedPayload)
    return false

  // need to hackily reset the event params so we can access the route rules of the base URL
  e.node.req.url = basePath
  e.context._nitro.routeRules = undefined
  const routeRules = getRouteRules(e)?.ogImage
  e.node.req.url = e.path

  // has been disabled via route rules
  if (routeRules === false)
    return false

  let payload = {
    path: basePath,
    ...extractOgPayload(html),
    ...inferOgPayload(html),
    ...(routeRules || {}),
    ...getQuery(e),
  } as OgImagePayload
  // provider defaults for satori payload
  if (payload.provider === 'satori') {
    payload = {
      title: 'Hello World',
      description: 'Example description',
      image: 'https://example.com/image.png',
      ...payload,
    }
  }
  return payload
})
