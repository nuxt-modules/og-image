import type { Browser } from 'playwright-core'
import { execa } from 'execa'
import terminate from 'terminate'
import { createConsola } from 'consola'
import playwrightCore from 'playwright-core'

let installedChromium = false
let installChromiumPromise: Promise<void>

export async function createBrowser(): Promise<Browser | void> {
  if (installChromiumPromise)
    await installChromiumPromise
  if (!installedChromium) {
    installChromiumPromise = new Promise<void>((_resolve) => {
      const logger = createConsola().withTag('Nuxt OG Image')
      // avoid problems by installing playwright
      logger.info('Installing Chromium install for og:image generation...')
      const installChromeProcess = execa('npx', ['playwright', 'install', 'chromium'], {
        stdio: 'inherit',
      })

      installChromeProcess.stderr?.pipe(process.stderr)
      new Promise((resolve) => {
        installChromeProcess.on('exit', (e) => {
          if (e !== 0)
            logger.error('Failed to install Playwright dependency for og:image generation. Trying anyway...')
          resolve(true)
        })
      }).then(() => {
        installChromeProcess.pid && terminate(installChromeProcess.pid)
        logger.info('Installed Chromium install for og:image generation.')
        _resolve()
      })
    }).then(() => {
      installedChromium = true
    })
  }

  return await playwrightCore.chromium.launch({
    headless: true,
  })
}
