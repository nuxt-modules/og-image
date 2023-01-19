import { defineEventHandler } from 'h3'
import { parseURL, withoutTrailingSlash } from 'ufo'
import { fetchPayload, useHostname } from '../../utils'

export default defineEventHandler(async (e) => {
  const path = parseURL(e.path).pathname
  if (!path.endsWith('/__og_image__'))
    return

  const basePath = withoutTrailingSlash(path.replace('__og_image__', ''))
  // extract the payload from the original path
  const payload = await fetchPayload(basePath)
  if (!payload)
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
<iframe src="${useHostname(e)}/__nuxt_og_image__/client/?&path=${withoutTrailingSlash(path.replace('__og_image__', ''))}"></iframe>`
})
