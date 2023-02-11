import { defineEventHandler, setHeader } from 'h3'
import { parseURL, withBase, withoutTrailingSlash } from 'ufo'
import { fetchOptions, useHostname } from '../utils'
import { useProvider } from '#nuxt-og-image/provider'

export default defineEventHandler(async (e) => {
  const path = parseURL(e.path).pathname
  // convert to regex
  if (!path.endsWith('__og_image__/og.png'))
    return

  const basePath = withoutTrailingSlash(path
    .replace('__og_image__/og.png', ''),
  )

  setHeader(e, 'Content-Type', 'image/png')
  // add http headers so the file isn't cached
  setHeader(e, 'Cache-Control', 'no-cache, no-store, must-revalidate')
  setHeader(e, 'Pragma', 'no-cache')
  setHeader(e, 'Expires', '0')

  const options = await fetchOptions(e, basePath)
  const provider = await useProvider(options.provider!)
  if (!provider) {
    return {
      status: 500,
      body: `Provider ${options.provider} is missing.`,
    }
  }
  return provider.createPng(withBase(basePath, useHostname(e)), options)
})
