import awsChromium from 'chrome-aws-lambda'
import { chromium } from 'playwright-core'

export default async function createBrowser() {
  return await chromium.launch({
    args: awsChromium.args,
    executablePath: await awsChromium.executablePath,
    headless: true,
  })
}
