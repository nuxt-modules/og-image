import { defineEventHandler, getRequestHeader, setHeader } from 'h3'
import type { Browser } from 'playwright-core'
import type { ScreenshotOptions } from '../../types'

export const HtmlRendererRoute = '__og_image'
export const RuntimeImageSuffix = 'og-image.png'

export async function screenshot(browser: Browser, url: string, options: ScreenshotOptions): Promise<Buffer> {
  const page = await browser.newPage({
    colorScheme: options.colorScheme,
  })
  await page.setViewportSize({
    width: options.width,
    height: options.height,
  })

  await page.goto(url, {
    timeout: 10000,
    waitUntil: 'networkidle',
  })

  if (options.mask) {
    await page.evaluate((mask) => {
      for (const el of document.querySelectorAll(mask) as any as HTMLElement[])
        el.style.display = 'none'
    }, options.mask)
  }
  if (options.selector)
    await page.locator(options.selector).screenshot()

  return await page.screenshot()
}

export async function createBrowser() {
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME)
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'test'
  const playwright = await import('playwright-core')
  const awsChrome = await import('chrome-aws-lambda')
  return await playwright.chromium.launch({
    args: awsChrome.args,
    executablePath: await awsChrome.executablePath,
    headless: awsChrome.headless,
  })
}

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
