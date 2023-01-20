import { parseURL, withBase, withoutTrailingSlash } from 'ufo'
import { renderSSRHead } from '@unhead/ssr'
import { createHeadCore } from '@unhead/vue'
import { defineEventHandler, sendRedirect } from 'h3'
import { fetchOptions, renderIsland, useHostname } from '../../utils'
import { defaults } from '#nuxt-og-image/config'

export default defineEventHandler(async (e) => {
  const path = parseURL(e.path).pathname
  if (!path.endsWith('__og_image__/html'))
    return

  const basePath = withoutTrailingSlash(path.replace('__og_image__/html', ''))

  // extract the options from the original path
  const options = await fetchOptions(basePath)

  // for screenshots just return the base path
  if (options.provider === 'browser')
    return sendRedirect(e, withBase(basePath, useHostname(e)))

  // using Nuxt Island, generate the og:image HTML
  const island = await renderIsland(options)

  const head = createHeadCore()
  head.push(island.head)
  head.push({
    style: [
      {
        innerHTML: 'body { font-family: \'Inter\', sans-serif; }',
      },
    ],
    script: [
      {
        src: 'https://cdn.tailwindcss.com',
      },
      // @todo merge with users tailwind
      {
        innerHTML: `tailwind.config = {
  corePlugins: {
    preflight: false,
  }
}`,
      },
    ],
    link: [
      {
        // reset css to match svg output
        href: 'https://cdn.jsdelivr.net/npm/gardevoir',
        rel: 'stylesheet',
      },
      {
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
        rel: 'stylesheet',
      },
    ],
  })
  const headChunk = await renderSSRHead(head)
  return `<!DOCTYPE html>
<html ${headChunk.htmlAttrs}>
<head>${headChunk.headTags}</head>
<body ${headChunk.bodyAttrs}>${headChunk.bodyTagsOpen}<div style="width: ${defaults.width}px; height: ${defaults.height}px; display: flex; margin: 0 auto;">${island.html}</div>${headChunk.bodyTags}</body>
</html>`
})
