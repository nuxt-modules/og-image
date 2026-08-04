import { fetchWithRedirectValidation } from '../../../util/ssrf'

// Sentinel origin used purely to canonicalize + classify a font path with the
// same WHATWG parser `fetch` uses. `.invalid` is reserved (RFC 2606) and never
// resolves, so it can't be a useful SSRF target even in the (unreachable)
// case where a path's own authority happens to equal it.
const SENTINEL_ORIGIN = 'http://font-asset.invalid/'
const SENTINEL_HOST = 'font-asset.invalid'

/** True for an inline `data:` font URI (no network — safe to decode directly). */
export function isDataFontUrl(path: string): boolean {
  return path.trimStart().toLowerCase().startsWith('data:')
}

/**
 * True when a font path carries its own authority (`//host`, `http://host`,
 * `\\host`) or a non-http scheme — i.e. it would not resolve same-origin.
 *
 * Classification resolves the path against a sentinel origin through the WHATWG
 * URL parser, so it sees exactly what `fetch` will: leading C0 controls/spaces,
 * embedded tab/CR/LF, and backslash folding are all normalized first. This
 * closes the bypass class where " //127.0.0.1" or " //169.254.169.254" looks
 * relative to a naive scheme check yet resolves cross-origin (GHSA-q8hw-4fvp-9rwv).
 * Check `isDataFontUrl` first — `data:` is non-http and would report true here.
 */
export function isExternalFontUrl(path: string): boolean {
  let resolved: URL
  try {
    resolved = new URL(path, SENTINEL_ORIGIN)
  }
  catch {
    // Unparseable even with a base: not a usable relative asset path. Force it
    // through the guard (which rejects it) rather than a raw same-origin fetch.
    return true
  }
  return resolved.protocol !== 'http:' || resolved.host !== SENTINEL_HOST
}

/**
 * Resolve an authority-bearing font URL to the href to fetch, but only when it
 * is same-origin with the configured site URL. Returns null otherwise.
 *
 * Runtime external font URLs are unsupported — `@nuxt/fonts` is the only
 * supported way to load custom fonts, and it serves them same-origin. The single
 * allowed exception is the site's own origin, gated on an explicitly configured
 * site URL. Resolving against that origin also collapses canonicalization
 * bypasses (a crafted " //127.0.0.1" resolves cross-origin → rejected).
 */
export function resolveSameOriginFontUrl(path: string, siteUrl: string | undefined): string | null {
  if (!siteUrl)
    return null
  let siteOrigin: string
  try {
    siteOrigin = new URL(siteUrl).origin
  }
  catch {
    return null
  }
  let target: URL
  try {
    target = new URL(path, siteOrigin)
  }
  catch {
    return null
  }
  return target.origin === siteOrigin ? target.href : null
}

/**
 * Fetch a `data:` or authority-bearing font URL. `data:` is decoded directly
 * (no network). An external URL is fetched only when same-origin with the site
 * URL, and always through the SSRF guard (scheme allowlist, private-network
 * block, per-hop redirect re-validation) so the site's own host can't be used
 * to relay into its internal network via an open redirect.
 *
 * Throws on an unsupported/blocked/unreachable URL so the caller falls back to a
 * bundled font; blocked targets stay indistinguishable from missing fonts.
 */
export async function fetchSpecialFontUrl(path: string, siteUrl: string | undefined, timeout: number): Promise<Buffer> {
  if (isDataFontUrl(path)) {
    const res = await fetch(path.trimStart(), { signal: AbortSignal.timeout(timeout) }).catch(() => {
      // Invalid inline font data is reported through the contextual error below.
      return null
    })
    if (res?.ok)
      return Buffer.from(await res.arrayBuffer())
    throw new Error('[Nuxt OG Image] Invalid data: font URL.')
  }

  const href = resolveSameOriginFontUrl(path, siteUrl)
  if (!href)
    throw new Error('[Nuxt OG Image] External font URLs are not supported. Load custom fonts via @nuxt/fonts.')

  const ab = await fetchWithRedirectValidation(href, { timeout })
  if (!ab)
    throw new Error('[Nuxt OG Image] Font URL blocked or unreachable.')
  return Buffer.from(ab)
}
