import { defineEventHandler, getRequestHeader, setHeader } from 'h3'
import { HtmlRendererRoute, RuntimeImageSuffix } from '../const'
import { createBrowser, screenshot } from '../../browserService'

export default defineEventHandler(async (e) => {
  if (!e.path?.endsWith(RuntimeImageSuffix))
    return

  const path = e.path.replace(RuntimeImageSuffix, HtmlRendererRoute)

  const host = getRequestHeader(e, 'host') || 'localhost:3000'
  // extract the payload from the original path
  const browser = await createBrowser()
  // set .png image header
  setHeader(e, 'Content-Type', 'image/png')
  return await screenshot(browser, `http${host.startsWith('localhost') ? '' : 's'}://${host}/${path}`, {
    width: 1200,
    height: 630,
  })
})
