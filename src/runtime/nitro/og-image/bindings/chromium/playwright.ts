import playwright from 'playwright'
import type { Browser } from 'playwright-core'

export async function createBrowser(): Promise<Browser | void> {
  return await playwright.chromium.launch({
    headless: true,
  })
}
