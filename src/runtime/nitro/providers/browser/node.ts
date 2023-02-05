import { isCI } from 'std-env'

export default async function createBrowser() {
  try {
    const playwrightCore = await import(String('playwright-core'))
    // try use a local chrome instance over downloading binaries
    const { Launcher } = await import(String('chrome-launcher'))
    const chromePath = Launcher.getFirstInstallation()
    return await playwrightCore.chromium.launch({
      headless: true,
      executablePath: chromePath,
    })
  }
  catch (e) {}
  try {
    const playwright = await import(String('playwright'))
    return await playwright.chromium.launch({
      headless: true,
    })
  }
  catch (e) {
    // doesn't matter if it fails, we fallback to a playwright dependency, unless we're on dev
    if (process.dev)
      console.warn('Failed to load chromium instance. Ensure you have chrome installed, otherwise add the dependency: `npm add -D playwright`.')
    // throw the error in the CI environment, we will need playwright
    if (isCI) {
      console.error('Failed to load browser instance. Please open an issue at: https://github.com/harlan-zw/nuxt-og-image/issues.')
      throw e
    }
  }
}
