/**
 * Convert container query / dynamic viewport units to pixels.
 * In OG image context, the "container" is the image itself (default 1200x630).
 */
const UNSUPPORTED_UNIT_RE = /(-?[\d.]+)(cqw|cqh|cqi|cqb|cqmin|cqmax|dvw|dvh|svw|svh|lvw|lvh)\b/g
export function resolveUnsupportedUnits(val: string, containerWidth?: number, containerHeight?: number): string {
  if (!UNSUPPORTED_UNIT_RE.test(val))
    return val
  return val.replace(UNSUPPORTED_UNIT_RE, (_, num, unit) => {
    const n = Number.parseFloat(num)
    if (Number.isNaN(n))
      return '0px'
    const w = containerWidth || 1200
    const h = containerHeight || 630
    const widthUnits = new Set(['cqw', 'cqi', 'dvw', 'svw', 'lvw'])
    const heightUnits = new Set(['cqh', 'cqb', 'dvh', 'svh', 'lvh'])
    if (widthUnits.has(unit))
      return `${(n / 100) * w}px`
    if (heightUnits.has(unit))
      return `${(n / 100) * h}px`
    // cqmin/cqmax
    const ref = unit === 'cqmin' ? Math.min(w, h) : Math.max(w, h)
    return `${(n / 100) * ref}px`
  })
}

export const GRADIENT_COLOR_SPACE_RE = /\s+in\s+(?:oklab|oklch|srgb(?:-linear)?|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz(?:-d(?:50|65))?|hsl|hwb|lab|lch)/g

/**
 * Strip gradient color interpolation methods (e.g. `in oklab`, `in oklch`)
 * from CSS gradient values. Image renderers (Satori, Takumi) don't support them.
 */
export function stripGradientColorSpace(value: string): string {
  if (typeof value !== 'string')
    return value
  return value.replace(GRADIENT_COLOR_SPACE_RE, '')
}

/**
 * Resolve `color-mix()` to rgba for renderers that don't support it.
 * Handles the common TW4 pattern: `color-mix(in <space>, <color> <amount>, transparent)`
 */
const COLOR_MIX_HEX_RE = /color-mix\(in\s+\w+,\s*#([0-9a-fA-F]{3,8})\s+([\d.]+%?)\s*,\s*transparent\s*\)/g
// eslint-disable-next-line no-control-regex
const COLOR_MIX_RGBA_RE = /color-mix\(in\s+\w+,\s*rgba?\((\d+)[\x09-\x0D\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*(?: |(?: \s*)?,)\s*(\d+)[\x09-\x0D\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*(?: |(?: \s*)?,)\s*(\d+)(?:\s*[/,]\s*[\d.]+)?\)\s+([\d.]+%?)\s*,\s*transparent\s*\)/g

function hexToRgb(hex: string): [number, number, number] | null {
  if (hex.length === 3)
    hex = hex[0]! + hex[0]! + hex[1]! + hex[1]! + hex[2]! + hex[2]!
  if (hex.length !== 6 && hex.length !== 8)
    return null
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b))
    return null
  return [r, g, b]
}

function parseColorMixAmount(amount: string): number {
  let opacity = Number.parseFloat(amount)
  if (Number.isNaN(opacity))
    return Number.NaN
  if (amount.endsWith('%'))
    opacity /= 100
  else if (opacity > 1)
    opacity /= 100
  return opacity
}

export function resolveColorMix(value: string): string {
  if (!value.includes('color-mix('))
    return value
  // Handle hex colors: color-mix(in oklab, #00bcfe .14, transparent)
  let result = value.replace(COLOR_MIX_HEX_RE, (_match, hex: string, amount: string) => {
    const rgb = hexToRgb(hex)
    if (!rgb)
      return _match
    const opacity = parseColorMixAmount(amount)
    if (Number.isNaN(opacity))
      return _match
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`
  })
  // Handle rgb/rgba colors: color-mix(in oklab, rgb(0, 188, 254) 14%, transparent)
  result = result.replace(COLOR_MIX_RGBA_RE, (_match, r: string, g: string, b: string, amount: string) => {
    const opacity = parseColorMixAmount(amount)
    if (Number.isNaN(opacity))
      return _match
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  })
  return result
}
