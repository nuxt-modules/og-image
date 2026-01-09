/**
 * URL encoding for OG image options (Cloudinary/IPX style)
 *
 * Format: /_og/s/w_1200,h_630,c_NuxtSeo,title_Hello+World.png
 *
 * - Known OgImageOptions use short aliases (w, h, c, etc.)
 * - Component props are encoded directly (title_Hello)
 * - Complex objects are base64 encoded JSON
 */

// Short aliases for OgImageOptions params
const PARAM_ALIASES: Record<string, string> = {
  w: 'width',
  h: 'height',
  c: 'component',
  r: 'renderer',
  em: 'emojis',
  k: 'key',
  a: 'alt',
  u: 'url',
  cache: 'cacheMaxAgeSeconds',
}

// Reverse mapping (param name -> alias)
const PARAM_TO_ALIAS = Object.fromEntries(
  Object.entries(PARAM_ALIASES).map(([alias, param]) => [param, alias]),
)

// Known OgImageOptions keys (not component props)
const KNOWN_PARAMS = new Set([
  'width', 'height', 'component', 'renderer', 'emojis', 'key', 'alt', 'url',
  'cacheMaxAgeSeconds', 'extension', 'html', 'satori', 'resvg', 'sharp',
  'screenshot', 'fonts', '_query', 'socialPreview', 'props',
])

// Params that need base64 encoding (complex objects)
const COMPLEX_PARAMS = new Set(['satori', 'resvg', 'sharp', 'screenshot', 'fonts', '_query'])

// Base64 encode/decode helpers (works in both browser and Node)
function b64Encode(str: string): string {
  if (typeof btoa === 'function')
    return btoa(str).replace(/=/g, '')
  return Buffer.from(str).toString('base64').replace(/=/g, '')
}

function b64Decode(str: string): string {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  if (typeof atob === 'function')
    return atob(padded)
  return Buffer.from(padded, 'base64').toString()
}

/**
 * Encode OG image options into a URL path segment
 * @example encodeOgImageParams({ width: 1200, props: { title: 'Hello' } })
 * // Returns: "w_1200,title_Hello"
 */
export function encodeOgImageParams(options: Record<string, any>): string {
  const parts: string[] = []

  // First, flatten props to top level for readability
  const flattened: Record<string, any> = {}
  for (const [key, value] of Object.entries(options)) {
    if (key === 'props' && typeof value === 'object') {
      // Flatten simple props to top level
      for (const [propKey, propValue] of Object.entries(value)) {
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
    if (value === undefined || value === null)
      continue

    // Skip internal/meta fields
    if (key === 'extension' || key === 'socialPreview')
      continue

    // Use alias for known params, otherwise use key as-is (for props)
    const alias = PARAM_TO_ALIAS[key] || key

    if (COMPLEX_PARAMS.has(key)) {
      // Base64 encode complex objects
      const b64 = b64Encode(JSON.stringify(value))
      parts.push(`${alias}_${b64}`)
    }
    else if (typeof value === 'object') {
      // Unexpected object (like remaining complex props), base64 encode
      const b64 = b64Encode(JSON.stringify(value))
      parts.push(`${alias}_${b64}`)
    }
    else {
      // Simple value - URL encode spaces as +, escape commas and underscores
      const encoded = String(value)
        .replace(/_/g, '__')
        .replace(/,/g, '%2C')
        .replace(/ /g, '+')
      parts.push(`${alias}_${encoded}`)
    }
  }

  return parts.join(',')
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

  // Split by comma, but not escaped commas (%2C)
  const parts = encoded.split(',')

  for (const part of parts) {
    // Find first underscore that's not escaped (not preceded by another underscore)
    const idx = part.search(/(?<!_)_(?!_)/)
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
      value = value
        .replace(/\+/g, ' ')
        .replace(/%2C/g, ',')
        .replace(/__/g, '_')
      // Try to parse as number or boolean
      if (value === 'true')
        options[paramName] = true
      else if (value === 'false')
        options[paramName] = false
      else {
        const num = Number(value)
        options[paramName] = Number.isNaN(num) ? value : num
      }
    }
    else {
      // Unknown param - treat as component prop
      value = value
        .replace(/\+/g, ' ')
        .replace(/%2C/g, ',')
        .replace(/__/g, '_')
      options.props = options.props || {}
      // Try to parse as number or boolean
      if (value === 'true')
        options.props[paramName] = true
      else if (value === 'false')
        options.props[paramName] = false
      else {
        const num = Number(value)
        options.props[paramName] = Number.isNaN(num) ? value : num
      }
    }
  }

  return options
}

/**
 * Build full OG image URL
 * @example buildOgImageUrl({ width: 1200, props: { title: 'Hello' } }, 'png', true)
 * // Returns: "/_og/s/w_1200,title_Hello.png"
 */
export function buildOgImageUrl(
  options: Record<string, any>,
  extension: string = 'png',
  isStatic: boolean = false,
): string {
  const encoded = encodeOgImageParams(options)
  const prefix = isStatic ? '/_og/s' : '/_og/d'
  return encoded ? `${prefix}/${encoded}.${extension}` : `${prefix}/default.${extension}`
}

/**
 * Parse OG image URL back into options
 * @example parseOgImageUrl("/_og/s/w_1200,h_630.png")
 * // Returns: { options: { width: 1200, height: 630 }, extension: 'png', isStatic: true }
 */
export function parseOgImageUrl(url: string): {
  options: Record<string, any>
  extension: string
  isStatic: boolean
} {
  const isStatic = url.includes('/_og/s/')
  const path = url.replace(/^\/_og\/[ds]\//, '')

  // Extract extension
  const extMatch = path.match(/\.(\w+)$/)
  const extension = extMatch?.[1] || 'png'

  // Get encoded params (without extension)
  const encoded = path.replace(/\.\w+$/, '')

  return {
    options: decodeOgImageParams(encoded),
    extension,
    isStatic,
  }
}
