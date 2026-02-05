import type { Buffer } from 'node:buffer'
import type { Browser, Page, PageScreenshotOptions } from 'playwright-core'
import type { OgImageRenderEventContext } from '../../../types'
import { useNitroOrigin } from '#site-config/server/composables'
import { withQuery } from 'ufo'
import { toValue } from 'vue'
import { buildOgImageUrl } from '../../../shared'
import { useOgImageRuntimeConfig } from '../../utils'

// Detect if we're using Playwright or Puppeteer
// Playwright has setViewportSize, Puppeteer has setViewport
function isPlaywrightPage(page: Page): boolean {
  return typeof (page as any).setViewportSize === 'function'
}

async function setViewport(page: Page, width: number, height: number): Promise<void> {
  if (isPlaywrightPage(page)) {
    await (page as any).setViewportSize({ width, height })
  }
  else {
    // Puppeteer API
    await (page as any).setViewport({ width, height })
  }
}

async function waitForIdle(page: Page): Promise<void> {
  if (isPlaywrightPage(page)) {
    await page.waitForLoadState('networkidle')
  }
  else {
    // Puppeteer doesn't have waitForLoadState, use a short delay as fallback
    // The page is already loaded since we used setContent, just wait for network
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

async function gotoWithIdle(page: Page, url: string, timeout: number): Promise<void> {
  if (isPlaywrightPage(page)) {
    await page.goto(url, { timeout, waitUntil: 'networkidle' })
  }
  else {
    // Puppeteer uses 'networkidle0' instead of 'networkidle'
    await (page as any).goto(url, { timeout, waitUntil: 'networkidle0' })
  }
}

async function waitForDelay(page: Page, ms: number): Promise<void> {
  if (isPlaywrightPage(page)) {
    await page.waitForTimeout(ms)
  }
  else {
    // Puppeteer also has waitForTimeout but may differ, use native timeout
    await new Promise(resolve => setTimeout(resolve, ms))
  }
}

async function takeScreenshot(page: Page, selector: string | undefined, options: PageScreenshotOptions): Promise<Buffer> {
  // Remove animations option for Puppeteer (not supported)
  const puppeteerOptions = { ...options }
  if (!isPlaywrightPage(page)) {
    delete (puppeteerOptions as any).animations
  }

  if (selector) {
    if (isPlaywrightPage(page)) {
      return await page.locator(selector).screenshot(puppeteerOptions)
    }
    else {
      // Puppeteer uses page.$(selector) instead of locator
      const element = await (page as any).$(selector)
      if (!element) {
        throw new Error(`Element not found: ${selector}`)
      }
      return await element.screenshot(puppeteerOptions)
    }
  }

  return await page.screenshot(puppeteerOptions)
}

export async function createScreenshot({ basePath, e, options, extension }: OgImageRenderEventContext, browser: Browser): Promise<Buffer> {
  const { colorPreference, defaults } = useOgImageRuntimeConfig()
  // For browser renderer, we need to load the HTML template with options encoded in URL
  const path = options.component === 'PageScreenshot' ? basePath : buildOgImageUrl(options, 'html', false, defaults).url

  // Create page - Playwright and Puppeteer have different newPage signatures
  let page: Page
  if (typeof (browser as any).newPage === 'function' && (browser as any).newPage.length === 0) {
    // Puppeteer: browser.newPage() takes no args, need to set options after
    page = await browser.newPage()
    // Set color scheme via emulation for Puppeteer
    if (colorPreference && colorPreference !== 'no-preference') {
      await (page as any).emulateMediaFeatures?.([
        { name: 'prefers-color-scheme', value: colorPreference },
      ])
    }
  }
  else {
    // Playwright: browser.newPage({ colorScheme, baseURL })
    page = await browser.newPage({
      colorScheme: colorPreference || 'no-preference',
      baseURL: useNitroOrigin(e),
    })
  }

  try {
    if (import.meta.prerender && !options.html) {
      // we need to do a nitro fetch for the HTML instead of rendering with browser
      options.html = await e.$fetch(path).catch(() => undefined) as string
    }

    await setViewport(
      page,
      toValue(options.width) || 1200,
      toValue(options.height) || 630,
    )

    if (options.html) {
      const html = options.html
      if (isPlaywrightPage(page)) {
        await page.evaluate((html) => {
          document.open('text/html')
          document.write(html)
          document.close()
        }, html)
        await waitForIdle(page)
      }
      else {
        // Puppeteer: use setContent instead of evaluate
        await (page as any).setContent(html, { waitUntil: 'networkidle0' })
      }
    }
    else {
      // avoid another fetch to the base path to resolve options
      const url = isPlaywrightPage(page)
        ? withQuery(path, options.props)
        : `${useNitroOrigin(e)}${withQuery(path, options.props)}`
      await gotoWithIdle(page, url, 10000)
    }

    const screenshotOptions: PageScreenshotOptions = {
      timeout: 10000,
      animations: 'disabled',
      type: extension === 'png' ? 'png' : 'jpeg',
    }

    const _options = options.screenshot || {}
    if (_options.delay)
      await waitForDelay(page, _options.delay)

    if (_options.mask) {
      await page.evaluate((mask) => {
        for (const el of document.querySelectorAll(mask) as any as HTMLElement[])
          el.style.display = 'none'
      }, _options.mask)
    }

    return await takeScreenshot(page, _options.selector, screenshotOptions)
  }
  finally {
    await page.close()
  }
}
