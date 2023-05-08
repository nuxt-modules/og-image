import edgeChromium from '@sparticuz/chrome-aws-lambda'
import puppeteer from 'puppeteer-core'

export default async function createBrowser() {
  return await puppeteer.launch({
    executablePath: await edgeChromium.executablePath,
    args: edgeChromium.args,
    headless: true,
  })
}
