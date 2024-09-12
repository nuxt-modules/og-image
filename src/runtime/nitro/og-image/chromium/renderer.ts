import type { Browser } from 'playwright-core'
import type { Renderer } from '../../../types'
import { createBrowser } from '#nuxt-og-image/bindings/chromium'
import { createError } from 'h3'
import { createScreenshot } from './screenshot'

const ChromiumRenderer: Renderer = {
  name: 'chromium',
  supportedFormats: ['png', 'jpeg', 'jpg'],
  async debug() {
    return {} // TODO
  },
  async createImage(ctx) {
    const browser: Browser = await createBrowser()
    const screenshot = await createScreenshot(ctx, browser!)
      .catch(e => e)
    await browser.close()
    if (screenshot instanceof Error) {
      return createError({
        statusCode: 400,
        cause: screenshot,
        statusMessage: `[Nuxt OG Image] Failed to create screenshot ${screenshot.message}.`,
      })
    }
    return screenshot
  },
}

export default ChromiumRenderer
