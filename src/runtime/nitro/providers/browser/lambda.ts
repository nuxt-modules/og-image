import edgeChromium from 'chrome-aws-lambda'
import puppeteer from 'puppeteer-core'

export default async function createBrowser() {
  return puppeteer.launch({
    args: edgeChromium.args,
    executablePath: await edgeChromium.executablePath,
    headless: true,
  })
}
