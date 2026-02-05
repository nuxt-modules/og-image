import type { H3Event } from 'h3'
import type { Browser } from 'playwright-core'
import playwright from 'playwright'

export async function createBrowser(_event?: H3Event): Promise<Browser | void> {
  return await playwright.chromium.launch({
    headless: true,
  })
}
