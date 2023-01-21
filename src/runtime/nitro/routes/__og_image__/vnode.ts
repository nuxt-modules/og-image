import { defineEventHandler, setHeader } from 'h3'
import { joinURL, parseURL, withBase, withoutTrailingSlash } from 'ufo'
import { fetchOptions, useHostname } from '../../utils'
import { useProvider } from '#nuxt-og-image/provider'

export default defineEventHandler(async (e) => {
  const path = parseURL(e.path).pathname
  // convert to regex
  if (!path.endsWith('__og_image__/vnode'))
    return

  const basePath = withoutTrailingSlash(path
    .replace('__og_image__/vnode', ''),
  )

  const options = await fetchOptions(basePath)
  // set json header
  setHeader(e, 'Content-Type', 'application/json')
  const provider = await useProvider(options.provider!)
  return provider.createVNode(withBase(joinURL(basePath, '/__og_image__/html'), useHostname(e)), options)
})
