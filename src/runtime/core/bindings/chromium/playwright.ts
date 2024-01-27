import type { Browser } from 'playwright-core'
import playwright from 'playwright'

export async function createBrowser(): Promise<Browser | void> {
  return await playwright.chromium.launch({
    headless: true,
  })
}
