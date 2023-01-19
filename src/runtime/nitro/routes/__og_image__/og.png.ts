import { defineEventHandler, setHeader } from 'h3'
import { parseURL, withBase, withoutTrailingSlash } from 'ufo'
import { fetchPayload, useHostname } from '../../utils'
import { useProvider } from '#nuxt-og-image/provider'

export default defineEventHandler(async (e) => {
  const path = parseURL(e.path).pathname
  // convert to regex
  if (!path.endsWith('__og_image__/og.png'))
    return

  const basePath = withoutTrailingSlash(path
    .replace('__og_image__/og.png', ''),
  )

  // extract the payload from the original path
  const { provider: providerName, prerender } = await fetchPayload(basePath)

  setHeader(e, 'Content-Type', 'image/png')
  if (prerender && !process.dev) {
    // add cache headers for a png, allowing up to 1 day
    setHeader(e, 'Cache-Control', 'public, max-age=86400')
  }
  else {
    // add http headers so the file isn't cached
    setHeader(e, 'Cache-Control', 'no-cache, no-store, must-revalidate')
    setHeader(e, 'Pragma', 'no-cache')
    setHeader(e, 'Expires', '0')
  }

  const provider = await useProvider(providerName!)
  return provider.createPng(withBase(`${basePath}/__og_image__/html`, useHostname(e)))
})
