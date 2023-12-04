import { execa } from 'execa'
import terminate from 'terminate'
import type { Nitro } from 'nitropack'

export async function ensureChromium(nitro: Nitro) {
  // avoid problems by installing playwright
  nitro.logger.info('Ensuring Chromium install for og:image generation...')
  const installChromeProcess = execa('npx', ['playwright', 'install', 'chromium'], {
    stdio: 'inherit',
  })

  installChromeProcess.stderr?.pipe(process.stderr)
  await new Promise((resolve) => {
    installChromeProcess.on('exit', (e) => {
      if (e !== 0)
        nitro.logger.error('Failed to install Playwright dependency for og:image generation. Trying anyway...')
      resolve(true)
    })
  })
  installChromeProcess.pid && terminate(installChromeProcess.pid)
}
