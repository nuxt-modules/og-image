import type { Buffer } from 'node:buffer'
import type { Browser, PageScreenshotOptions } from 'playwright-core'
import type { ScreenshotOptions } from '../types'

export async function screenshot(browser: Browser, options: Partial<ScreenshotOptions> & Record<string, any>): Promise<Buffer> {
  const page = await browser.newPage({
    colorScheme: options.colorScheme,
  })
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
    await page.goto(`${options.host}${options.path}`, {
      timeout: (process.env.prerender || process.dev) ? 10000 : 2000,
      waitUntil: 'networkidle',
    })
  }

  const screenshotOptions: PageScreenshotOptions = {
    timeout: (process.env.prerender || process.dev) ? 10000 : 2000,
  }

  if (options.delay)
    await page.waitForTimeout(options.delay)

  if (options.mask) {
    await page.evaluate((mask) => {
      for (const el of document.querySelectorAll(mask) as any as HTMLElement[])
        el.style.display = 'none'
    }, options.mask)
  }
  if (options.selector)
    return await page.locator(options.selector).screenshot(screenshotOptions)

  const screenshot = await page.screenshot(screenshotOptions)
  await page.close()
  return screenshot
}
