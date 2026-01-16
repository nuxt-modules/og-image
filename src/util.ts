import { resolvePath } from '@nuxt/kit'
import { Launcher } from 'chrome-launcher'
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

const VALID_RENDERER_SUFFIXES = ['satori', 'chromium', 'takumi'] as const

export function getRendererFromFilename(filepath: string): 'satori' | 'chromium' | 'takumi' | null {
  const filename = filepath.split('/').pop()?.replace('.vue', '') || ''
  for (const suffix of VALID_RENDERER_SUFFIXES) {
    if (filename.endsWith(`.${suffix}`))
      return suffix
  }
  return null
}

export function stripRendererSuffix(name: string): string {
  for (const suffix of VALID_RENDERER_SUFFIXES) {
    if (name.endsWith(`.${suffix}`) || name.endsWith(suffix.charAt(0).toUpperCase() + suffix.slice(1)))
      return name.replace(new RegExp(`[.]?${suffix}$`, 'i'), '')
  }
  return name
}
