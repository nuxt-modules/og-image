import type { Browser } from 'playwright'
import {ScreenshotOptions} from "./types";
export async function createBrowser (options: ScreenshotOptions) {
  const playwright = await import('playwright')
  console.log(options)
  return await playwright['chromium'].launch({
    chromiumSandbox: true,
    defaultViewport: {
      width: options.width,
      height: options.height
    }
  })
}

export async function screenshot (browser: Browser, url: string, options: ScreenshotOptions): Promise<Buffer> {
  const page = await browser.newPage({
    colorScheme: options.colorScheme,
  })
  await page.setViewportSize({
    width: options.width,
    height: options.height,
  });

  if (url.startsWith('html:')) {
    await page.evaluate((html) => {
      document.open('text/html')
      document.write(html)
      document.close()
    }, decodeURI(url.substring(5)))
  } else {
    await page.goto(url, {
      timeout: 10000,
      waitUntil: 'networkidle',
    })
  }

  if (options.mask) {
    await page.evaluate((mask) => {
      for (const el of document.querySelectorAll(mask) as any as HTMLElement[]) {
        el.style.display = 'none'
      }
    }, options.mask)
  }
  if (options.selector) {
    await page.locator(options.selector).screenshot()
  }

  return await page.screenshot()
}

export const extractOgPayload = (html: string) => {
  // extract the og:title from the html
  const title = html.match(/<meta property="og:title" content="(.*?)">/)?.[1]
  // extract the og:description from the html
  const description = html.match(/<meta property="og:description" content="(.*?)">/)?.[1]
  // extract the meta og-image-payload from the html
  const payload = html.match(/<meta name="og-image-payload" content="(.*?)">/)?.[1]
  return {
    title,
    description,
    payload
  }
}
