import type { Browser } from 'playwright-core'
import type { Renderer } from '../../../types'
import { createScreenshot } from './screenshot'
import { createBrowser } from '#nuxt-og-image/bindings/chromium'

const ChromiumRenderer: Renderer = {
  name: 'chromium',
  supportedFormats: ['png', 'jpeg', 'jpg'],
  async debug() {
    return {} // TODO
  },
  async createImage(ctx) {
    const browser: Browser = await createBrowser()
    // check if browser is open
    if (!browser.isConnected()) {
      return createError({
        statusCode: 400,
        statusMessage: 'Failed to create connect to Chromium Browser.',
      })
    }
    const screenshot = await createScreenshot(ctx, browser!)
      .catch(e => e)
    if (screenshot instanceof Error) {
      return createError({
        statusCode: 400,
        statusMessage: `Failed to create screenshot ${screenshot.message}.`,
      })
    }
    await browser.close()
    return screenshot
  },
}

export default ChromiumRenderer
