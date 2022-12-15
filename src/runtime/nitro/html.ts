import { withQuery, withoutTrailingSlash } from 'ufo'
import { renderSSRHead } from '@unhead/ssr'
import { createHeadCore } from '@unhead/vue'
import { defineEventHandler, getQuery } from 'h3'
export const HtmlRendererRoute = '__og_image'
export const PayloadScriptId = 'nuxt-og-image-payload'

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

export default defineEventHandler(async (req) => {
  if (!req.path?.endsWith(HtmlRendererRoute))
    return

  const path = req.path.replace(HtmlRendererRoute, '')

  // extract the payload from the original path
  const html = await $fetch(withoutTrailingSlash(path))
  const payload = {
    path,
    title: 'Hello World',
    description: 'Example description',
    image: 'https://example.com/image.png',
    ...extractOgPayload(html),
    ...inferOgPayload(html),
    ...getQuery(req),
  }

  // using Nuxt Island, generate the og:image HTML
  const result = await $fetch(withQuery(`/__nuxt_island/${payload.component || 'OgImage'}`, {
    props: JSON.stringify(payload),
  }))
  const head = createHeadCore()
  head.push(result.head)
  head.push({
    style: [
      {
        innerHTML: 'body { margin: 0; padding: 0; } .og-image-container { width: 1200px; height: 630px; display: flex; margin: 0 auto; }',
      },
    ],
  })
  const headChunk = await renderSSRHead(head)
  return `<!DOCTYPE html>
<html ${headChunk.htmlAttrs}>
<head>${headChunk.headTags}</head>
<body ${headChunk.bodyAttrs}>${headChunk.bodyTagsOpen}<div class="og-image-container">${result.html}</div>${headChunk.bodyTags}</body>
</html>`
})
