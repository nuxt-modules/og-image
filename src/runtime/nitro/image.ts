import { createError, defineEventHandler, getRequestHeader, setHeader } from 'h3'
import { screenshot } from '../browserUtil'
import { DefaultRuntimeImageSuffix, HtmlRendererRoute } from '#nuxt-og-image/constants'
import { createBrowser } from '#nuxt-og-image/browser'

export default defineEventHandler(async (e) => {
  if (!e.path?.endsWith(DefaultRuntimeImageSuffix))
    return

  const path = e.path.replace(DefaultRuntimeImageSuffix, HtmlRendererRoute)

  const host = getRequestHeader(e, 'host') || 'localhost:3000'
  // extract the payload from the original path
  const browser = await createBrowser()
  if (!browser)
    return createError('Could not create browser')

  // set .png image header
  setHeader(e, 'Content-Type', 'image/png')
  return await screenshot(browser!, `http${host.startsWith('localhost') ? '' : 's'}://${host}/${path}`, {
    width: 1200,
    height: 630,
  })
})
