import { resolvePath } from '@nuxt/kit'
import { Launcher } from 'chrome-launcher'
import { basename } from 'pathe'
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

const VALID_RENDERER_SUFFIXES = ['satori', 'browser', 'takumi'] as const

export function getRendererFromFilename(filepath: string): 'satori' | 'browser' | 'takumi' | null {
  const filename = basename(filepath).replace('.vue', '')
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

export type RendererSuffix = typeof VALID_RENDERER_SUFFIXES[number]

export interface ParsedComponentName {
  baseName: string
  renderer: RendererSuffix | null
}

/**
 * Parse a component name into base name + renderer.
 * Supports: 'Banner.satori', 'BannerSatori', 'Banner'
 */
export function matchesComponentName(registeredPascalName: string, inputName: string): boolean {
  const cBase = registeredPascalName
    .replace(/^OgImage(Community|Template)?/, '')
    .replace(/\.?(satori|browser|takumi)$/i, '')
    .replace(/(Satori|Browser|Takumi)$/, '')
  const { baseName } = parseComponentName(inputName)
  const strippedBaseName = baseName.replace(/^OgImage/, '')
  return cBase === baseName
    || cBase === strippedBaseName
    || cBase === `OgImage${baseName}`
    || cBase === `OgImage${strippedBaseName}`
}

export function parseComponentName(name: string): ParsedComponentName {
  // dot notation: 'Banner.satori'
  for (const suffix of VALID_RENDERER_SUFFIXES) {
    if (name.endsWith(`.${suffix}`)) {
      return { baseName: name.slice(0, -(suffix.length + 1)), renderer: suffix }
    }
  }
  // PascalCase suffix: 'BannerSatori'
  for (const suffix of VALID_RENDERER_SUFFIXES) {
    const pascalSuffix = suffix.charAt(0).toUpperCase() + suffix.slice(1)
    if (name.endsWith(pascalSuffix)) {
      return { baseName: name.slice(0, -pascalSuffix.length), renderer: suffix }
    }
  }
  // bare name: 'Banner'
  return { baseName: name, renderer: null }
}
