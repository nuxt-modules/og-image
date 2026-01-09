import type { Buffer } from 'node:buffer'
import type { Browser, PageScreenshotOptions } from 'playwright-core'
import type { OgImageRenderEventContext } from '../../../types'
import { useNitroOrigin } from '#site-config/server/composables'
import { withQuery } from 'ufo'
import { toValue } from 'vue'
import { buildOgImageUrl } from '../../../shared'
import { useOgImageRuntimeConfig } from '../../utils'

export async function createScreenshot({ basePath, e, options, extension }: OgImageRenderEventContext, browser: Browser): Promise<Buffer> {
  const { colorPreference } = useOgImageRuntimeConfig()
  // For chromium, we need to load the HTML template with options encoded in URL
  const path = options.component === 'PageScreenshot' ? basePath : buildOgImageUrl(options, 'html', false)
  const page = await browser.newPage({
    colorScheme: colorPreference || 'no-preference',
    baseURL: useNitroOrigin(e),
  })
  try {
    if (import.meta.prerender && !options.html) {
      // we need to do a nitro fetch for the HTML instead of rendering with playwright
      options.html = await e.$fetch(path).catch(() => undefined) as string
    }
    await page.setViewportSize({
      width: toValue(options.width) || 1200,
      height: toValue(options.height) || 630,
    })

    if (options.html) {
      const html = options.html
      await page.evaluate((html) => {
        document.open('text/html')
        document.write(html)
        document.close()
      }, html)
      await page.waitForLoadState('networkidle')
    }
    else {
      // avoid another fetch to the base path to resolve options
      await page.goto(withQuery(path, options.props), {
        timeout: 10000,
        waitUntil: 'networkidle',
      })
    }

    const screenshotOptions: PageScreenshotOptions = {
      timeout: 10000,
      animations: 'disabled',
      type: extension === 'png' ? 'png' : 'jpeg',
    }

    const _options = options.screenshot || {}
    if (_options.delay)
      await page.waitForTimeout(_options.delay)

    if (_options.mask) {
      await page.evaluate((mask) => {
        for (const el of document.querySelectorAll(mask) as any as HTMLElement[])
          el.style.display = 'none'
      }, _options.mask)
    }
    if (_options.selector)
      return await page.locator(_options.selector).screenshot(screenshotOptions)

    return await page.screenshot(screenshotOptions)
  }
  finally {
    await page.close()
  }
}
