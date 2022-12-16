import type { Browser } from 'playwright-core'
import type { ScreenshotOptions } from '../types'

export async function createBrowser() {
  try {
    // AWS lambda or google cloud functions
    const playwrightCore = await import('playwright-core')
    // trick chrome-aws-lambda to run
    process.env.AWS_LAMBDA_FUNCTION_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME || 'RUNTIME_HACK'
    const awsChrome = await import(String('chrome-aws-lambda'))
    return await playwrightCore.chromium.launch({
      args: awsChrome.args,
      executablePath: await awsChrome.executablePath,
      headless: awsChrome.headless,
    })
  }
  catch (e) {}
  try {
    const playwrightCore = await import('playwright-core')
    // try use a local chrome instance over downloading binaries
    const { Launcher } = await import('chrome-launcher')
    const chromePath = Launcher.getFirstInstallation()
    return await playwrightCore.chromium.launch({
      headless: true,
      executablePath: chromePath,
    })
  }
  catch (e) {}
  try {
    const playwright = await import(String('playwright'))
    return await playwright.chromium.launch({
      headless: true,
    })
  }
  catch (e) {
    throw new Error(`
      Missing chromium binary. You need either 'playwright' or 'chrome-aws-lambda'.
      Please run 'yarn add --dev playwright' or 'npm install --save-dev playwright'
    `)
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

