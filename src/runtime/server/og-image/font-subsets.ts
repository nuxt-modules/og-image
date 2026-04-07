import type { RuntimeFontConfig } from '../../types'

/**
 * Rename unicode-range subset fonts so renderers can fall back between them.
 *
 * Both Satori and Takumi pick the first loaded font file for a given family
 * name and don't fall back to other font files for missing glyphs. When CJK
 * fonts like "Noto Sans SC" are split into 100+ unicode-range subsets by
 * fontsource, each covering ~200 characters, this means only one subset's
 * glyphs render while the rest show as .notdef boxes.
 *
 * Fix: rename each subset to "Family__N" and use font-family fallback chains
 * so renderers try each subset in order per character.
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
    // Only rename when multiple distinct data blobs exist (subset fonts)
    const needsRename = members.length > 1
      && new Set(members.map(f => f.cacheKey)).size > 1
    if (!needsRename) {
      result.push(...members)
      continue
    }
    changed = true
    for (let i = 0; i < members.length; i++) {
      const f = members[i]!
      result.push({
        ...f,
        originalFamily: f.originalFamily || f.family,
        family: `${f.family}__${i}`,
      })
    }
  }
  return changed ? result : fonts
}

/**
 * Build a mapping from original family names to their renamed subset chain.
 * E.g., "Noto Sans SC" → ["Noto Sans SC__0", "Noto Sans SC__1", ...]
 */
export function buildSubsetFamilyChain(fonts: RuntimeFontConfig[]): Map<string, string[]> {
  const chains = new Map<string, string[]>()
  for (const f of fonts) {
    if (!f.originalFamily)
      continue
    const arr = chains.get(f.originalFamily)
    if (arr)
      arr.push(f.family)
    else
      chains.set(f.originalFamily, [f.family])
  }
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
