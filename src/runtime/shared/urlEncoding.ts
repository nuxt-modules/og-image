import { hash } from 'ohash'

/**
 * URL encoding for OG image options (Cloudinary/IPX style)
 *
 * Format: /_og/s/w_1200,h_600,c_NuxtSeo,title_Hello+World.png
 *
 * When the encoded path exceeds MAX_PATH_LENGTH (200 chars), falls back to hash mode:
 * Format: /_og/s/o_<hash>.png
 *
 * - Known OgImageOptions use short aliases (w, h, c, etc.)
 * - Component props are encoded directly (title_Hello)
 * - Complex objects are base64 encoded JSON
 */

// Maximum path segment length (filesystem limit is 255, leave room for prefix/extension)
const MAX_PATH_LENGTH = 200

// Module-scope regex constants
const RE_BASE64_PADDING = /=/g
const RE_BASE64_PLUS = /\+/g
const RE_BASE64_SLASH = /\//g
const RE_BASE64_URL_DASH = /-/g
const RE_BASE64_URL_TILDE = /~/g
const RE_UNDERSCORE = /_/g
const RE_DOUBLE_UNDERSCORE = /__/g
const RE_PERCENT20 = /%20/g
const RE_PLUS = /\+/g
const RE_SINGLE_UNDERSCORE = /(?<!_)_(?!_)/
const RE_OG_PATH_PREFIX = /^\/_og\/[ds]\//
const RE_OG_ROUTE_PREFIX = /\/_og\/[ds]\//
const RE_FILE_EXTENSION_WITH_CAPTURE = /\.(\w+)$/
const RE_FILE_EXTENSION = /\.\w+$/
const RE_HASH_SEGMENT = /^o_([a-z0-9]+)$/i
const RE_COMMA_PARAM_SEPARATOR = /,(?=\w+_)/
// eslint-disable-next-line no-control-regex
const RE_NON_ASCII = /[^\u0000-\u007F]/

// Short aliases for OgImageOptions params
const PARAM_ALIASES: Record<string, string> = {
  w: 'width',
  h: 'height',
  c: 'component',
  em: 'emojis',
  k: 'key',
  a: 'alt',
  u: 'url',
  cache: 'cacheMaxAgeSeconds',
  p: '_path', // page path - needs alias since _path starts with underscore
  q: '_query', // query params - needs alias since _query starts with underscore
  ch: '_componentHash', // component template hash for cache busting prerendered URLs
}

// Reverse mapping (param name -> alias)
const PARAM_TO_ALIAS = Object.fromEntries(
  Object.entries(PARAM_ALIASES).map(([alias, param]) => [param, alias]),
)

// Known OgImageOptions keys (not component props)
const KNOWN_PARAMS = new Set([
  'width',
  'height',
  'component',
  'renderer',
  'emojis',
  'key',
  'alt',
  'url',
  'cacheMaxAgeSeconds',
  'cacheKey',
  'extension',
  'satori',
  'resvg',
  'sharp',
  'screenshot',
  'takumi',
  'fonts',
  '_query',
  '_hash',
  '_componentHash',
  'socialPreview',
  'props',
  '_path',
])

// Params that need base64 encoding (complex objects, or values with slashes)
const COMPLEX_PARAMS = new Set(['satori', 'resvg', 'sharp', 'screenshot', 'takumi', 'fonts', '_query', '_path'])

// URL-safe base64 encode/decode helpers (works in both browser and Node, handles Unicode)
// Uses ~ instead of / and - instead of + to avoid breaking URL path segments
function b64Encode(str: string): string {
  // UTF-8 encode first to handle Unicode (emojis, etc.)
  let encoded: string
  if (typeof btoa === 'function') {
    const utf8 = new TextEncoder().encode(str)
    const binary = String.fromCharCode(...utf8)
    encoded = btoa(binary)
  }
  else {
    encoded = Buffer.from(str, 'utf8').toString('base64')
  }
  // Make URL-safe: strip padding, replace + with - and / with ~
  // Using ~ instead of standard URL-safe _ to avoid conflict with param separator
  return encoded.replace(RE_BASE64_PADDING, '').replace(RE_BASE64_PLUS, '-').replace(RE_BASE64_SLASH, '~')
}

function b64Decode(str: string): string {
  // Reverse URL-safe encoding before standard base64 decode
  // Also handles legacy standard base64 (no ~ or - chars to replace = no-op)
  const standard = str.replace(RE_BASE64_URL_DASH, '+').replace(RE_BASE64_URL_TILDE, '/')
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4)
  if (typeof atob === 'function') {
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  }
  return Buffer.from(padded, 'base64').toString('utf8')
}

/**
 * Simple hash function for creating short deterministic hashes
 * Works in both browser and Node environments
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  // Convert to base36 for shorter string, ensure positive
  return Math.abs(hash).toString(36)
}

/**
 * Generate a deterministic hash from options object
 * Excludes _path so images with same options can be cached across pages
 * Optionally includes componentHash and version for cache busting
 */
export function hashOgImageOptions(
  options: Record<string, any>,
  componentHash?: string,
  version?: string,
): string {
  const { _path, _hash, ...hashableOptions } = options
  const hashInput = componentHash || version
    ? [hashableOptions, componentHash || '', version || '']
    : hashableOptions
  return simpleHash(JSON.stringify(hashInput))
}

/**
 * Encode OG image options into a URL path segment
 * @param options - The options to encode
 * @param defaults - Optional defaults to skip (values matching defaults won't be encoded)
 * @example encodeOgImageParams({ width: 1200, props: { title: 'Hello' } })
 * // Returns: "w_1200,title_Hello"
 */
export function encodeOgImageParams(options: Record<string, any>, defaults?: Record<string, any>): string {
  const parts: string[] = []

  // First, flatten props to top level for readability
  const flattened: Record<string, any> = {}
  for (const [key, value] of Object.entries(options)) {
    if (key === 'props' && typeof value === 'object') {
      // Flatten simple props to top level
      for (const [propKey, propValue] of Object.entries(value)) {
        if (propValue === undefined || propValue === null)
          continue
        if (typeof propValue === 'string' || typeof propValue === 'number' || typeof propValue === 'boolean') {
          flattened[propKey] = propValue
        }
        else {
          // Complex prop value - keep in props for base64 encoding
          flattened.props = flattened.props || {}
          flattened.props[propKey] = propValue
        }
      }
    }
    else {
      flattened[key] = value
    }
  }

  for (const [key, value] of Object.entries(flattened)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    // Skip internal/meta fields
    if (key === 'extension' || key === 'socialPreview')
      continue

    // Skip default/empty values that the decoder already handles
    // _path defaults to "/" on decode, _query empty object is a no-op
    if (key === '_path' && value === '/')
      continue
    if (key === '_query' && typeof value === 'object' && Object.keys(value).length === 0)
      continue

    // Skip values that match defaults (but never skip component)
    if (defaults && key in defaults && defaults[key] === value && key !== 'component')
      continue

    // Use alias for known params, otherwise use key as-is (for props)
    const alias = PARAM_TO_ALIAS[key] || key

    if (COMPLEX_PARAMS.has(key)) {
      // Base64 encode complex objects
      const json = JSON.stringify(value)
      if (json === '{}')
        continue
      const b64 = b64Encode(json)
      parts.push(`${alias}_${b64}`)
    }
    else if (typeof value === 'object') {
      // Unexpected object (like remaining complex props), base64 encode
      const json = JSON.stringify(value)
      if (json === '{}')
        continue
      const b64 = b64Encode(json)
      parts.push(`${alias}_${b64}`)
    }
    else {
      const str = String(value)
      if (RE_NON_ASCII.test(str)) {
        // Non-ASCII values use base64 to avoid percent-encoded UTF-8 in the URL path.
        // h3 v1.15.7+ decodes percent-encoded req.url which breaks proxies.
        // Prefix with ~ so the decoder knows to b64-decode instead of URL-decode.
        parts.push(`${alias}_~${b64Encode(str)}`)
      }
      else {
        // ASCII-safe value: try URL encoding first, then check for problematic percent-encoding.
        // Characters like #, ?, /, \, =, & produce %XX sequences that get decoded by
        // proxies, CDNs, and prerender crawlers in unpredictable ways (#528, #529).
        // If percent-encoding is needed, use b64 instead to avoid these issues entirely.
        const escaped = str.startsWith('~') ? `~${str}` : str
        const encoded = encodeURIComponent(escaped.replace(RE_UNDERSCORE, '__'))
          .replace(RE_PERCENT20, '+') // spaces as +
        if (encoded.includes('%')) {
          // Value contains URL-sensitive chars; b64 encode to prevent intermediary decoding
          parts.push(`${alias}_~${b64Encode(str)}`)
        }
        else {
          parts.push(`${alias}_${encoded}`)
        }
      }
    }
  }

  return parts.join(',')
}

const RE_NUMERIC = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/

/**
 * Parse a string as a number only if it's actually numeric.
 * Avoids false positives like Number('+') → 0 or Number('') → 0.
 */
function tryParseNumber(value: string): string | number {
  if (RE_NUMERIC.test(value)) {
    const num = Number(value)
    if (!Number.isNaN(num))
      return num
  }
  return value
}

/**
 * Decode a simple string value, handling ~ prefix for b64-encoded non-ASCII
 * and ~~ escape for literal values starting with ~.
 */
function decodeSimpleValue(raw: string): string {
  if (raw.startsWith('~~')) {
    // Escaped leading ~ — decode the rest normally
    return decodeURIComponent(raw.slice(1).replace(RE_PLUS, '%20')).replace(RE_DOUBLE_UNDERSCORE, '_')
  }
  if (raw.startsWith('~')) {
    // b64-encoded non-ASCII value
    try {
      return b64Decode(raw.slice(1))
    }
    catch {
      // Fallback: treat as literal value if b64 decode fails
      return decodeURIComponent(raw.replace(RE_PLUS, '%20')).replace(RE_DOUBLE_UNDERSCORE, '_')
    }
  }
  return decodeURIComponent(raw.replace(RE_PLUS, '%20')).replace(RE_DOUBLE_UNDERSCORE, '_')
}

/**
 * Decode URL path segment back into OG image options
 * @example decodeOgImageParams("w_1200,title_Hello")
 * // Returns: { width: 1200, props: { title: 'Hello' } }
 */
export function decodeOgImageParams(encoded: string): Record<string, any> {
  if (!encoded || encoded === 'default')
    return {}

  const options: Record<string, any> = {}

  // Split on commas that are followed by a param key pattern (e.g. `key_`).
  const parts = encoded.split(RE_COMMA_PARAM_SEPARATOR)

  for (const part of parts) {
    // Find first underscore that's not escaped (not preceded by another underscore)
    const idx = part.search(RE_SINGLE_UNDERSCORE)
    if (idx === -1)
      continue

    const alias = part.slice(0, idx)
    let value = part.slice(idx + 1)

    // Resolve alias to full param name
    const paramName = PARAM_ALIASES[alias] || alias

    if (COMPLEX_PARAMS.has(paramName)) {
      // Base64 decode complex objects
      try {
        const json = b64Decode(value)
        options[paramName] = JSON.parse(json)
      }
      catch {
        options[paramName] = value
      }
    }
    else if (paramName === 'props') {
      // Base64 encoded remaining complex props
      try {
        const json = b64Decode(value)
        options.props = { ...options.props, ...JSON.parse(json) }
      }
      catch {
        // ignore
      }
    }
    else if (KNOWN_PARAMS.has(paramName)) {
      // Known OgImageOptions param - decode value
      value = decodeSimpleValue(value)
      // Try to parse as number or boolean
      if (value === 'true') {
        options[paramName] = true
      }
      else if (value === 'false') {
        options[paramName] = false
      }
      else if (value !== '') {
        options[paramName] = tryParseNumber(value)
      }
    }
    else {
      // Unknown param - treat as component prop
      value = decodeSimpleValue(value)
      options.props = options.props || {}
      // Try to parse as number or boolean
      if (value === 'true') {
        options.props[paramName] = true
      }
      else if (value === 'false') {
        options.props[paramName] = false
      }
      else if (value !== '') {
        options.props[paramName] = tryParseNumber(value)
      }
    }
  }

  return options
}

export interface BuildOgImageUrlResult {
  url: string
  hash?: string
}

/**
 * Build full OG image URL
 *
 * When encoded params exceed MAX_PATH_LENGTH, falls back to hash mode:
 * - Returns short path: /_og/s/o_<hash>.png
 * - Returns hash in result for cache storage
 *
 * @param options - The options to encode
 * @param extension - Image extension (png, jpeg, etc.)
 * @param isStatic - Whether this is a static/prerendered image
 * @param defaults - Optional defaults to skip from URL (keeps URLs shorter)
 * @example buildOgImageUrl({ width: 1200, props: { title: 'Hello' } }, 'png', true)
 * // Returns: { url: "/_og/s/w_1200,title_Hello.png" }
 */
export function buildOgImageUrl(
  options: Record<string, any>,
  extension: string = 'png',
  isStatic: boolean = false,
  defaults?: Record<string, any>,
  secret?: string,
): BuildOgImageUrlResult {
  const encoded = encodeOgImageParams(options, defaults)
  const prefix = isStatic ? '/_og/s' : '/_og/d'

  // Check if encoded path is too long or contains percent-encoded chars (only applies to static/prerendered)
  // Hash mode requires prerender options cache, so it can't work at runtime
  // Percent-encoded chars (%23=#, %3F=?, %2C=, etc.) get decoded by prerender crawlers,
  // proxies, and CDNs in unpredictable ways — hash mode avoids this entirely
  if (isStatic && (encoded.length > MAX_PATH_LENGTH || encoded.includes('%'))) {
    // Use hash mode - short deterministic path
    const hash = hashOgImageOptions(options)
    return {
      url: `${prefix}/o_${hash}.${extension}`,
      hash,
    }
  }

  const segment = encoded || 'default'
  // When a secret is provided, append HMAC signature to the path segment
  const signed = secret ? `${segment},s_${signEncodedParams(segment, secret)}` : segment

  return {
    url: `${prefix}/${signed}.${extension}`,
  }
}

/**
 * Sign encoded params using ohash (SHA-256 based, cross-runtime compatible).
 * Returns first 16 chars of the base64url hash for URL brevity.
 */
export function signEncodedParams(encoded: string, secret: string): string {
  return hash(`${secret}:${encoded}`).slice(0, 16)
}

/**
 * Verify a signature against encoded params.
 * Uses constant-time string comparison to prevent timing attacks.
 */
export function verifyOgImageSignature(encoded: string, signature: string, secret: string): boolean {
  const expected = signEncodedParams(encoded, secret)
  if (expected.length !== signature.length)
    return false
  // constant-time comparison
  let result = 0
  for (let i = 0; i < expected.length; i++)
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  return result === 0
}

/**
 * Parse OG image URL back into options
 * @example parseOgImageUrl("/_og/s/w_1200,h_600.png")
 * // Returns: { options: { width: 1200, height: 600 }, extension: 'png', isStatic: true, hash: undefined }
 * @example parseOgImageUrl("/_og/s/o_abc123.png")
 * // Returns: { options: {}, extension: 'png', isStatic: true, hash: 'abc123' }
 */
export function parseOgImageUrl(url: string): {
  options: Record<string, any>
  extension: string
  isStatic: boolean
  hash?: string
} {
  const isStatic = url.includes('/_og/s/')
  const path = url.replace(RE_OG_PATH_PREFIX, '')

  // Extract extension
  const extMatch = path.match(RE_FILE_EXTENSION_WITH_CAPTURE)
  const extension = extMatch?.[1] || 'png'

  // Get encoded params (without extension)
  const encoded = path.replace(RE_FILE_EXTENSION, '')

  // Check for hash mode (o_<hash>)
  const hashMatch = encoded.match(RE_HASH_SEGMENT)
  if (hashMatch) {
    return {
      options: {},
      extension,
      isStatic,
      hash: hashMatch[1],
    }
  }

  return {
    options: decodeOgImageParams(encoded),
    extension,
    isStatic,
  }
}

/**
 * Extract the encoded segment from the full path, handling the case where
 * %2F in prop values has been decoded to / by intermediaries (#522).
 * Uses the full catch-all match after /_og/d/ (or /_og/s/) instead of
 * only the last path segment.
 */
export function extractEncodedSegment(path: string, extension: string): string {
  const match = path.match(RE_OG_ROUTE_PREFIX)
  if (match?.index != null) {
    return path.slice(match.index + match[0].length).replace(new RegExp(`\\.${extension}$`), '')
  }
  return (path.split('/').pop() as string).replace(new RegExp(`\\.${extension}$`), '')
}
