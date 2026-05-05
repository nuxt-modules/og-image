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
 * - When `preferStatic` is set (takumi), prefers the full static satoriSrc over a subset WOFF2
 *   primary src. @nuxt/fonts CSS often ships only the latin subset for a family, so using the
 *   subset would hide non-latin glyphs (devanagari, CJK) the static file covers.
 * - Variable fonts (entries carrying `weightRange`) are an exception: the per-weight static
 *   `satoriSrc` would discard the wght axis, leaving the runtime to stair-step requested
 *   weights through whatever weights fontless happened to download (e.g. requested 400 maps
 *   to the closest available static, often 100 or 700, with a hard jump in the middle).
 *   Keep the variable WOFF2 primary src so takumi can vary the axis at render time.
 * - Otherwise, uses the primary src when the renderer can parse its format, falling back to
 *   satoriSrc as a static alternative when the primary format is unsupported (satori + WOFF2).
 *
 * Returns null when no src on this entry can be parsed by the renderer.
 */
export function selectFontSource(
  f: { src: string, satoriSrc?: string, weightRange?: [number, number] },
  supportedFormats: Set<FontFormat>,
  preferStatic: boolean,
): { src: string, isStaticFallback: boolean } | null {
  const primarySupported = supportedFormats.has(fontFormat(f.src))
  const satoriSupported = !!(f.satoriSrc && supportedFormats.has(fontFormat(f.satoriSrc)))
  const isVariable = !!f.weightRange
  if (preferStatic && !isVariable && satoriSupported && f.satoriSrc !== f.src)
    return { src: f.satoriSrc!, isStaticFallback: true }
  if (primarySupported)
    return { src: f.src, isStaticFallback: false }
  if (satoriSupported)
    return { src: f.satoriSrc!, isStaticFallback: true }
  return null
}
