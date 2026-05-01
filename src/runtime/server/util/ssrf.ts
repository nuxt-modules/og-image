// SSRF prevention for OG image asset fetching.
//
// Two surfaces are guarded:
//   1. `isBlockedUrl(url)` — host/IP classifier covering IPv4 (dotted, decimal,
//      hex), IPv6 (incl. zone IDs, embedded IPv4, IPv4-mapped hex form), and
//      the standard set of internal RFC ranges plus deprecated/reserved
//      prefixes that have been used as bypasses (RFC 3879, 9602, 9637, 8215).
//   2. `fetchWithRedirectValidation(url, opts)` — performs the fetch with
//      `redirect: 'manual'` and re-runs the host classifier on every Location
//      hop, so an allowed origin returning a 30x to an internal IP cannot
//      complete the SSRF.
//
// History: see GHSA-pqhr-mp3f-hrpp (initial denylist) and GHSA-c2rm-g55x-8hr5
// (IPv6 prefix gaps + redirect bypass) for the bypass classes this is sized
// to defeat.

const RE_IPV6_BRACKETS = /^\[|\]$/g
const RE_DIGIT_ONLY = /^\d+$/
const RE_INT_IP = /^(?:0x[\da-f]+|\d+)$/i
const RE_HEX_GROUP = /^[0-9a-f]{1,4}$/i
const RE_IPV6_CHARS = /^[0-9a-f:.]+$/i
const RE_TRAILING_V4 = /(\d+\.\d+\.\d+\.\d+)$/

const MAX_REDIRECTS = 5

function isPrivateIPv4(a: number, b: number): boolean {
  if (a === 127)
    return true // 127.0.0.0/8 loopback
  if (a === 10)
    return true // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31)
    return true // 172.16.0.0/12
  if (a === 192 && b === 168)
    return true // 192.168.0.0/16
  if (a === 169 && b === 254)
    return true // link-local
  if (a === 0)
    return true // 0.0.0.0/8 — also catches the unspecified address
  return false
}

/**
 * Expand an IPv6 string to its 8 16-bit groups. Accepts `::` shorthand,
 * embedded IPv4 in the trailing 32 bits (`::ffff:1.2.3.4`), and zone IDs
 * (stripped). Returns `null` for any malformed input.
 */
export function expandIPv6(addr: string): number[] | null {
  // Strip RFC 6874 zone id (e.g. fe80::1%eth0). The link-local check below
  // catches fe80::/10 regardless of zone, so the zone string is discarded.
  const noZone = addr.split('%')[0]!
  if (!noZone || !RE_IPV6_CHARS.test(noZone))
    return null

  // Fold a trailing dotted-quad (`::ffff:1.2.3.4`) into two hex groups so the
  // remainder can be parsed uniformly.
  let work = noZone
  const v4Match = work.match(RE_TRAILING_V4)
  if (v4Match) {
    const octets = v4Match[1]!.split('.').map(Number)
    if (octets.some(o => !Number.isFinite(o) || o < 0 || o > 255))
      return null
    const hi = ((octets[0]! << 8) | octets[1]!).toString(16)
    const lo = ((octets[2]! << 8) | octets[3]!).toString(16)
    work = `${work.slice(0, -v4Match[1]!.length) + hi}:${lo}`
  }

  const parts = work.split('::')
  if (parts.length > 2)
    return null
  const head = parts[0] ? parts[0].split(':') : []
  const tail = (parts[1] !== undefined && parts[1]) ? parts[1].split(':') : []

  if (parts.length === 1) {
    if (head.length !== 8)
      return null
  }
  else if (head.length + tail.length > 7) {
    return null
  }

  const fillCount = parts.length === 2 ? 8 - head.length - tail.length : 0
  const allGroups = [...head, ...Array.from<string>({ length: fillCount }).fill('0'), ...tail]
  const result: number[] = []
  for (const g of allGroups) {
    if (!RE_HEX_GROUP.test(g))
      return null
    result.push(Number.parseInt(g, 16))
  }
  return result
}

function isPrivateIPv6(groups: number[]): boolean {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups as [number, number, number, number, number, number, number, number]

  // ::1 loopback
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0 && g7 === 1)
    return true

  // :: unspecified
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0 && g7 === 0)
    return true

  // ::ffff:0:0/96 IPv4-mapped — recover embedded IPv4 and re-classify
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xFFFF) {
    const a = (g6 >> 8) & 0xFF
    const b = g6 & 0xFF
    return isPrivateIPv4(a, b)
  }

  // 64:ff9b::/96 NAT64 well-known prefix — embedded IPv4
  if (g0 === 0x64 && g1 === 0xFF9B && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    const a = (g6 >> 8) & 0xFF
    const b = g6 & 0xFF
    return isPrivateIPv4(a, b)
  }

  // 64:ff9b:1::/48 NAT64 local-use (RFC 8215) — entire range is internal
  if (g0 === 0x64 && g1 === 0xFF9B && g2 === 1)
    return true

  // fc00::/7 unique local
  if ((g0 & 0xFE00) === 0xFC00)
    return true

  // fe80::/10 link-local
  if ((g0 & 0xFFC0) === 0xFE80)
    return true

  // fec0::/10 site-local — RFC 3879 deprecated but still routable on legacy nets
  if ((g0 & 0xFFC0) === 0xFEC0)
    return true

  // 2001:db8::/32 documentation
  if (g0 === 0x2001 && g1 === 0x0DB8)
    return true

  // 3fff::/20 documentation v2 (RFC 9637)
  if ((g0 & 0xFFF0) === 0x3FF0)
    return true

  // 5f00::/16 SRv6 SIDs (RFC 9602)
  if (g0 === 0x5F00)
    return true

  // ff00::/8 multicast — not directly SSRF but no legitimate image-fetch use
  if ((g0 & 0xFF00) === 0xFF00)
    return true

  return false
}

/**
 * Returns true if the URL points at an internal/private network or otherwise
 * unsafe target. Only `http:` and `https:` are accepted; everything else is
 * blocked outright.
 */
export function isBlockedUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return true
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    return true

  const hostname = parsed.hostname.toLowerCase()
  const bare = hostname.replace(RE_IPV6_BRACKETS, '')

  if (bare === 'localhost' || bare.endsWith('.localhost'))
    return true

  // Dotted-decimal IPv4
  const dottedParts = bare.split('.')
  if (dottedParts.length === 4 && dottedParts.every(p => RE_DIGIT_ONLY.test(p))) {
    const octets = dottedParts.map(Number)
    if (octets.some(o => o > 255))
      return true
    return isPrivateIPv4(octets[0]!, octets[1]!)
  }

  // Single integer (decimal/hex) IPv4: `2130706433`, `0x7f000001`
  if (RE_INT_IP.test(bare)) {
    const num = Number(bare)
    if (Number.isFinite(num) && num >= 0 && num <= 0xFFFFFFFF)
      return isPrivateIPv4((num >>> 24) & 0xFF, (num >>> 16) & 0xFF)
  }

  // IPv6 — only attempt when a colon is present; bare hostnames with letters
  // would otherwise hit the IPv6 parser and slow us down for nothing.
  if (bare.includes(':')) {
    const groups = expandIPv6(bare)
    if (groups)
      return isPrivateIPv6(groups)
    // unparseable IPv6-looking string — refuse rather than fall through to the
    // public-name branch
    return true
  }

  return false
}

export interface SafeFetchOptions {
  timeout: number
  headers?: Record<string, string>
  signal?: AbortSignal
}

/**
 * Fetch a URL with manual redirect handling. Each hop (including the initial
 * URL) is run through `isBlockedUrl` before the request is dispatched, so an
 * allowed origin returning a 30x to an internal IP cannot complete the SSRF.
 *
 * Returns `null` on any failure (block, network error, non-2xx, redirect
 * limit). The caller treats null as a soft failure and falls back to the
 * usual missing-asset behaviour.
 */
export async function fetchWithRedirectValidation(
  initialUrl: string,
  opts: SafeFetchOptions,
): Promise<ArrayBuffer | null> {
  const controller = new AbortController()
  const externalAbort = opts.signal
  const onExternalAbort = () => controller.abort(externalAbort?.reason)
  if (externalAbort) {
    if (externalAbort.aborted)
      controller.abort(externalAbort.reason)
    else
      externalAbort.addEventListener('abort', onExternalAbort, { once: true })
  }
  const timer = setTimeout(() => controller.abort(new Error('timeout')), opts.timeout)
  try {
    let url = initialUrl
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (isBlockedUrl(url))
        return null
      const res = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: opts.headers,
      })
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (!loc)
          return null
        // Resolve relative redirects against the current hop
        url = new URL(loc, url).toString()
        continue
      }
      if (!res.ok)
        return null
      return await res.arrayBuffer()
    }
    return null
  }
  catch {
    return null
  }
  finally {
    clearTimeout(timer)
    if (externalAbort)
      externalAbort.removeEventListener('abort', onExternalAbort)
  }
}
