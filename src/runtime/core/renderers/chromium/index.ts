import type { Browser } from 'playwright-core'
import type { Renderer } from '../../../types'
import { prerenderChromiumContext } from '../../cache/prerender'
import { createScreenshot } from './screenshot'
import { createBrowser } from '#nuxt-og-image/bindings/chromium'

const ChromiumRenderer: Renderer = {
  name: 'chromium',
  supportedFormats: ['png', 'jpeg', 'jpg'],
  async debug() {
    return {} // TODO
  },
  async createImage(ctx) {
    let browser: Browser = (import.meta.prerender ? prerenderChromiumContext.browser : null) || await createBrowser()
    // check if browser is open
    // lets us re-use the browser
    if (import.meta.prerender) {
      prerenderChromiumContext.browser = browser
      // if not, open it
      if (!browser.isConnected())
        browser = await createBrowser()
    }

    if (!browser.isConnected()) {
      return createError({
        statusCode: 400,
        statusMessage: 'Failed to create connect to Chromium Browser.',
      })
    }

    // @todo return placeholder image on failure
    return createScreenshot(ctx, browser!).finally(async () => {
      if (!import.meta.prerender) // closed by
        await browser!.close()
    })
  },
}

export default ChromiumRenderer
