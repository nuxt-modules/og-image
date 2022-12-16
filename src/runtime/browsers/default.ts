export async function createBrowser() {
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
  catch (e) {}
}
