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
 * Known OgImage directory prefixes and their last PascalCase word.
 * Nuxt deduplicates when a filename starts with the last word(s) of the directory prefix,
 * so we need to account for that when matching user input to registered names.
 */
const OGIMAGE_PREFIXES = [
  { prefix: 'OgImageCommunity', overlapWord: 'Community' },
  { prefix: 'OgImageTemplate', overlapWord: 'Template' },
  { prefix: 'OgImage', overlapWord: 'Image' },
] as const

/**
 * Get all possible base names for a registered component PascalCase name.
 * Returns multiple candidates to handle Nuxt's PascalCase word deduplication.
 */
export function getRegisteredBaseNames(registeredPascalName: string): string[] {
  const stripped = registeredPascalName
    .replace(/\.?(satori|browser|takumi)$/i, '')
    .replace(/(Satori|Browser|Takumi)$/, '')

  const names: string[] = []
  for (const { prefix, overlapWord } of OGIMAGE_PREFIXES) {
    if (!stripped.startsWith(prefix))
      continue
    const withoutPrefix = stripped.slice(prefix.length)
    if (withoutPrefix) {
      names.push(withoutPrefix)
      // Account for Nuxt deduplication: re-prepend the overlap word as an alternative
      if (withoutPrefix !== overlapWord)
        names.push(overlapWord + withoutPrefix)
    }
    else {
      // Full dedup: the entire filename was consumed by the prefix overlap
      // e.g. OgImage/Image.satori.vue → OgImageSatori → withoutPrefix is ''
      names.push(overlapWord)
    }
    break
  }

  if (names.length === 0)
    names.push(stripped)

  return names
}

/**
 * Check if a registered component name matches a user-provided input name.
 */
export function matchesComponentName(registeredPascalName: string, inputName: string): boolean {
  const baseNames = getRegisteredBaseNames(registeredPascalName)
  const { baseName } = parseComponentName(inputName)
  const strippedBaseName = baseName.replace(/^OgImage/, '')
  return baseNames.some(cBase =>
    cBase === baseName
    || cBase === strippedBaseName
    || cBase === `OgImage${baseName}`
    || cBase === `OgImage${strippedBaseName}`,
  )
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
