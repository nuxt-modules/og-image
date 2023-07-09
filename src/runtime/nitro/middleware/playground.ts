import { defineEventHandler } from 'h3'
import { parseURL, withBase, withoutTrailingSlash } from 'ufo'
import { fetchOptionsCached } from '../utils'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (e) => {
  const path = withoutTrailingSlash(parseURL(e.path).pathname)
  if (!path.endsWith('/__og_image__'))
    return

  const basePath = withBase(path.replace('/__og_image__', ''), useRuntimeConfig().app.baseURL)

  // extract the payload from the original path
  const options = await fetchOptionsCached(e, basePath === '' ? '/' : basePath)
  if (!options)
    return `The route ${basePath} has not been set up for og:image generation.`

  return `
<style>
  body {
    margin: 0;
    padding: 0;
  }
  iframe {
    border: none;
    width: 100%;
    height: 100%;
  }
</style>
<title>OG Image Playground</title>
<iframe src="/__nuxt_og_image__/client?&path=${basePath}&base=${useRuntimeConfig().app.baseURL}"></iframe>`
})
