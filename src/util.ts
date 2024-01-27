import { Launcher } from 'chrome-launcher'
import { tryResolveModule } from '@nuxt/kit'
import { isCI } from 'std-env'

export const isUndefinedOrTruthy = (v?: any) => typeof v === 'undefined' || v !== false

export function checkLocalChrome() {
  // quick path for CI
  if (isCI)
    return false

  let hasChromeLocally = false
  try {
    hasChromeLocally = !!Launcher.getFirstInstallation()
  }
  catch {}
  return hasChromeLocally
}

export async function checkPlaywrightDependency() {
  return !!(await tryResolveModule('playwright'))
}
