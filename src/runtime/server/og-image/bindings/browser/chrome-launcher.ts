import type { H3Event } from 'h3'
import type { Browser } from 'playwright-core'
import { Launcher } from 'chrome-launcher'
import playwrightCore from 'playwright-core'

const chromePath = Launcher.getFirstInstallation()

export async function createBrowser(_event?: H3Event): Promise<Browser | void> {
  return playwrightCore.chromium.launch({
    headless: true,
    executablePath: chromePath,
  })
}
