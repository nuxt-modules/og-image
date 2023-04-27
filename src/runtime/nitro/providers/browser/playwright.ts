import playwrightCore from 'playwright-core'

export default async function createBrowser() {
  // try just using the core playwright to launch chromium
  try {
    return await playwrightCore.chromium.launch({
      headless: true,
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
    if (process.dev) {
      console.warn('Failed to load chromium instance. Ensure you have chrome installed, otherwise add the dependency: `npm add -D playwright`.')
    }
    else {
      // throw the error in the CI environment, we will need playwright
      console.error('Failed to load browser instance. Please open an issue with the exception: https://github.com/harlan-zw/nuxt-og-image/issues.')
      throw e
    }
  }
}
