import type { Browser } from 'playwright-core'
import playwrightCore from 'playwright-core'

export function createBrowser(): Promise<Browser | void> {
  // try just using the core playwright to launch chromium
  return playwrightCore.chromium.launch({
    headless: true,
  })
}
