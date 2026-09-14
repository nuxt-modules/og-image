import type { RuntimeFontConfig } from '../../types'
import { fnv1a64Base36 } from 'fnv1a-64'

/**
 * Give subsets stable names so renderers can fall back between their glyphs.
 * Renderers cache registrations by name across renders with different filtered subsets.
 */
export function renameSubsetFonts(fonts: RuntimeFontConfig[]): RuntimeFontConfig[] {
  // Group by family+weight+style identity
  const groups = new Map<string, RuntimeFontConfig[]>()
  for (const f of fonts) {
    const key = `${f.family}\0${f.weight}\0${f.style}`
    const arr = groups.get(key)
    if (arr)
      arr.push(f)
    else
      groups.set(key, [f])
  }

  const result: RuntimeFontConfig[] = []
  let changed = false
  for (const members of groups.values()) {
    // A filtered render can contain only one unicode-range subset.
    const needsRename = members.some(f => f.unicodeRange)
      || (members.length > 1 && new Set(members.map(f => f.cacheKey)).size > 1)
    if (!needsRename) {
      result.push(...members)
      continue
    }
    changed = true
    for (const f of members) {
      result.push({
        ...f,
        originalFamily: f.originalFamily || f.family,
        family: `${f.family}__${fnv1a64Base36(f.src || f.localPath || f.cacheKey)}`,
      })
    }
  }
  return changed ? result : fonts
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
