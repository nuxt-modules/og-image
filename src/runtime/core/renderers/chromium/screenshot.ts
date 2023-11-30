import type { Buffer } from 'node:buffer'
import type { Browser, PageScreenshotOptions } from 'playwright-core'
import { withQuery } from 'ufo'
import type { H3Event } from 'h3'
import type { RendererOptions } from '../../../types'
import { useNitroOrigin } from '#imports'

export async function createScreenshot(e: H3Event, browser: Browser, options: RendererOptions): Promise<Buffer> {
  // TODO add screenshotOptions
  const page = await browser.newPage({
    colorScheme: options.colorScheme,
    baseURL: useNitroOrigin(e),
  })
  if (import.meta.prerender && !options.html) {
    // we need to do a nitro fetch for the HTML instead of rendering with playwright
    options.html = await e.$fetch(options.path)
  }
  try {
    await page.setViewportSize({
      width: options.width || 1200,
      height: options.height || 630,
    })

    const isHtml = options.html || options.path?.startsWith('html:')
    if (isHtml) {
      const html = options.html || options.path?.substring(5)
      await page.evaluate((html) => {
        document.open('text/html')
        document.write(html)
        document.close()
      }, html)
      await page.waitForLoadState('networkidle')
    }
    else {
      // avoid another fetch to the base path to resolve options
      await page.goto(withQuery(options.path, options), {
        timeout: 10000,
        waitUntil: 'networkidle',
      })
    }

    let type = options.extension
    if (type === 'jpg')
      type = 'jpeg'
    const screenshotOptions: PageScreenshotOptions = {
      timeout: 10000,
      animations: 'disabled',
      type,
    }

    // if (options.delay)
    //   await page.waitForTimeout(options.delay)

    if (options.mask) {
      await page.evaluate((mask) => {
        for (const el of document.querySelectorAll(mask) as any as HTMLElement[])
          el.style.display = 'none'
      }, options.mask)
    }
    if (options.selector)
      return await page.locator(options.selector).screenshot(screenshotOptions)

    return await page.screenshot(screenshotOptions)
  }
  finally {
    await page.close()
  }
}
