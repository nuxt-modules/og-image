import type { Browser } from 'playwright-core'
import type { H3Event } from '#nuxtseo/h3'
import playwright from 'playwright'

// Playwright's launch can hang waiting for the browser process to start
// (slow disk, antivirus, missing deps). Pass `timeout` to its launcher so
// the launch itself rejects rather than blocking the request indefinitely.
export async function createBrowser(_event?: H3Event): Promise<Browser | void> {
  return await playwright.chromium.launch({
    headless: true,
    timeout: 15_000,
  })
}
