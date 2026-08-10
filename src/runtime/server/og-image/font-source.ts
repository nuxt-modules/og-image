export type FontFormat = 'ttf' | 'otf' | 'woff' | 'woff2'

export function fontFormat(src: string): FontFormat {
  if (src.endsWith('.woff2'))
    return 'woff2'
  if (src.endsWith('.woff'))
    return 'woff'
  if (src.endsWith('.otf'))
    return 'otf'
  return 'ttf'
}

/**
 * Pick the src to actually load for a parsed font entry.
 *
 * Uses the primary source when the renderer supports it, preserving WOFF2
 * subsets and variable axes for Takumi. Otherwise it uses the Satori fallback.
 *
 * Returns null when no src on this entry can be parsed by the renderer.
 */
export function selectFontSource(
  f: { src: string, satoriSrc?: string },
  supportedFormats: Set<FontFormat>,
): { src: string, isStaticFallback: boolean } | null {
  const primarySupported = supportedFormats.has(fontFormat(f.src))
  const satoriSupported = !!(f.satoriSrc && supportedFormats.has(fontFormat(f.satoriSrc)))
  if (primarySupported)
    return { src: f.src, isStaticFallback: false }
  if (satoriSupported)
    return { src: f.satoriSrc!, isStaticFallback: true }
  return null
}
