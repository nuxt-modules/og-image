import type { RuntimeFontConfig } from '../../types'
import { fnv1a64Base36 } from 'fnv1a-64'

/**
 * Give subsets stable names so renderers can fall back between their glyphs.
 * Renderers cache registrations by name across renders with different filtered subsets.
 */
export function renameSubsetFonts(fonts: RuntimeFontConfig[]): RuntimeFontConfig[] {
  const groups = new Map<string, RuntimeFontConfig[]>()
  for (const font of fonts) {
    const members = groups.get(font.family)
    if (members)
      members.push(font)
    else
      groups.set(font.family, [font])
  }

  const aliases = new Map<RuntimeFontConfig, string>()
  for (const members of groups.values()) {
    const faces = new Map<string, RuntimeFontConfig[]>()
    for (const font of members) {
      const face = `${font.weight}\0${font.style}`
      const subsets = faces.get(face)
      if (subsets)
        subsets.push(font)
      else
        faces.set(face, [font])
    }
    const needsRename = members.some(font => font.unicodeRange)
      || [...faces.values()].some(subsets => new Set(subsets.map(font => font.cacheKey)).size > 1)
    if (!needsRename)
      continue

    // Align subset faces so renderers can select the requested weight and style.
    // Include every registration in the alias to prevent stale cross-render caches.
    const slots: RuntimeFontConfig[][] = []
    for (const subsets of faces.values()) {
      const binaries = new Map<string, RuntimeFontConfig[]>()
      for (const font of subsets) {
        const source = font.src || font.localPath || font.cacheKey
        const entries = binaries.get(source)
        if (entries)
          entries.push(font)
        else
          binaries.set(source, [font])
      }
      const ordered = [...binaries.values()].sort((a, b) => {
        const left = `${a[0]!.unicodeRange || ''}\0${a[0]!.src || a[0]!.localPath || a[0]!.cacheKey}`
        const right = `${b[0]!.unicodeRange || ''}\0${b[0]!.src || b[0]!.localPath || b[0]!.cacheKey}`
        return left < right ? -1 : left > right ? 1 : 0
      })
      for (const [index, entries] of ordered.entries())
        (slots[index] ||= []).push(...entries)
    }
    for (const slot of slots) {
      const identities = [...new Set(slot.map(font => JSON.stringify([
        font.weight,
        font.style,
        font.src || font.localPath || font.cacheKey,
      ])))].sort()
      const alias = `${slot[0]!.family}__${fnv1a64Base36(JSON.stringify(identities))}`
      for (const font of slot)
        aliases.set(font, alias)
    }
  }
  return aliases.size
    ? fonts.map(font => aliases.has(font)
        ? { ...font, originalFamily: font.originalFamily || font.family, family: aliases.get(font)! }
        : font)
    : fonts
}

/**
 * Build a mapping from original family names to their renamed subset chain.
 * E.g., "Noto Sans SC" → ["Noto Sans SC__<hash-a>", "Noto Sans SC__<hash-b>", ...]
 */
export function buildSubsetFamilyChain(fonts: RuntimeFontConfig[]): Map<string, string[]> {
  const chains = new Map<string, string[]>()
  for (const f of fonts) {
    if (f.originalFamily)
      chains.set(f.originalFamily, [])
  }
  for (const f of fonts)
    chains.get(f.originalFamily || f.family)?.push(f.family)
  return chains
}

/**
 * Resolve a font family name through subset chains (case-insensitive).
 * Returns the chain of renamed subset names, or undefined if not a subset font.
 */
export function resolveSubsetChain(family: string, chains: Map<string, string[]>): string[] | undefined {
  const direct = chains.get(family)
  if (direct)
    return direct
  const lower = family.toLowerCase()
  for (const [key, value] of chains) {
    if (key.toLowerCase() === lower)
      return value
  }
}
