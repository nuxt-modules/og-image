import type { Browser } from 'playwright-core'
import { Launcher } from 'chrome-launcher'
import playwrightCore from 'playwright-core'

const chromePath = Launcher.getFirstInstallation()

export async function createBrowser(): Promise<Browser | void> {
  return playwrightCore.chromium.launch({
    headless: true,
    executablePath: chromePath,
  })
}
