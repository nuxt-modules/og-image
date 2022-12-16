import type { Browser } from 'playwright-core'
import type { ScreenshotOptions } from '../types'

const debugBinaryUsage = (s: string, error?: any) => {
  if (!process.dev) {
    // eslint-disable-next-line no-console
    console.log(s, error)
  }
}

export async function createBrowser() {
  if ((process.env.NITRO_PRESET || '').includes('edge')) {
    debugBinaryUsage('Using Nitro Edge Preset.')
    try {
      // AWS lambda or google cloud functions
      const puppeteer = await import(String('puppeteer-core'))
      // trick chrome-aws-lambda to run
      process.env.AWS_LAMBDA_FUNCTION_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME || 'RUNTIME_HACK'
      const awsChrome = await import(String('chrome-aws-lambda'))
      return await puppeteer.launch({
        args: awsChrome.args,
        executablePath: await awsChrome.executablePath,
        headless: true,
      })
    }
    catch (e) {
      debugBinaryUsage('[nuxt-og-image] Skipping chrome-aws-lambda', e)
    }
  }
  else {
    try {
      const playwrightCore = await import(String('playwright-core'))
      // try use a local chrome instance over downloading binaries
      const { Launcher } = await import(String('chrome-launcher'))
      const chromePath = Launcher.getFirstInstallation()
      return await playwrightCore.chromium.launch({
        headless: true,
        executablePath: chromePath,
      })
    }
    catch (e) {
      debugBinaryUsage('[nuxt-og-image] Skipping chrome-launcher', e)
    }
    try {
      const playwright = await import(String('playwright'))
      return await playwright.chromium.launch({
        headless: true,
      })
    }
    catch (e) {
      if (!process.dev)
        debugBinaryUsage('[nuxt-og-image] Playwright failed', e)
      throw new Error(`
      Missing chromium binary. Please run "npx playwright install".
    `)
    }
  }
}

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

