import type { Storage } from 'unstorage'
import type { ResolvedFontConfig } from './runtime/types'
import { resolvePath } from '@nuxt/kit'
import { Launcher } from 'chrome-launcher'
import { $fetch } from 'ofetch'
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
  catch { }
  return hasChromeLocally
}

export async function hasResolvableDependency(dep: string) {
  return await resolvePath(dep, { fallbackToOriginal: true })
    .catch(() => null)
    .then(r => r && r !== dep)
}
