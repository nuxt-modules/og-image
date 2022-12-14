import { defineEventHandler } from '#imports'
import {withQuery} from "ufo";
import { renderSSRHead } from '@unhead/ssr'
import { createHeadCore } from '@unhead/vue'
import { getQuery } from 'h3'
export default defineEventHandler(async (req) => {
  const query = getQuery(req)
  console.log(query)
  const result = await $fetch(withQuery(`/__nuxt_island/${query.template}`, {
    props: JSON.stringify({
      path: query.path || '/',
      title: query.title || 'Hello World',
      description: query.description || 'Example description',
      image: query.image || 'https://example.com/image.png',
    })
  }))
  const head = createHeadCore()
  head.push(result.head)
  head.push({
    style: [
      {
        innerHTML: '.og-image-container { width: 1200px; height: 630px; display: flex; margin: 0 auto; }'
      }
    ]
  })
  const headChunk = await renderSSRHead(head)
  return `<!DOCTYPE html>
<html ${headChunk.htmlAttrs}>
<head>${headChunk.headTags}</head>
<body ${headChunk.bodyAttrs}>${headChunk.bodyTagsOpen}<div class="og-image-container">${result.html}</div>${headChunk.bodyTags}</body>
</html>`
})
