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
    // TODO redirect for screenshot
    // TODO maybe keep this alive
    const browser: Browser = (import.meta.prerender ? prerenderChromiumContext.browser : null) || await createBrowser()
    if (!browser) {
      return createError({
        statusCode: 400,
        statusMessage: 'Failed to create Local Chromium Browser.',
      })
    }
    // lets us re-use the browser
    if (import.meta.prerender)
      prerenderChromiumContext.browser = browser

    // @todo return placeholder image on failure
    return createScreenshot(ctx, browser!).finally(async () => {
      await browser!.close()
    })
  },
}

export default ChromiumRenderer
