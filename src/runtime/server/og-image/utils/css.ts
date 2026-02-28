/**
 * Split a CSS style string into individual declarations, respecting
 * parentheses (e.g. `url(...)`) and quoted strings so that semicolons
 * inside data URIs like `url("data:image/svg+xml;utf8,...")` are not
 * treated as declaration separators.
 */
export function splitCssDeclarations(style: string): string[] {
  const declarations: string[] = []
  let current = ''
  let parenDepth = 0
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let i = 0; i < style.length; i++) {
    const char = style[i]!
    if (char === '\'' && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
    }
    else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
    }
    else if (!inSingleQuote && !inDoubleQuote) {
      if (char === '(') {
        parenDepth++
      }
      else if (char === ')') {
        parenDepth = Math.max(0, parenDepth - 1)
      }
      else if (char === ';' && parenDepth === 0) {
        if (current.trim())
          declarations.push(current)
        current = ''
        continue
      }
    }
    current += char
  }
  if (current.trim())
    declarations.push(current)
  return declarations
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
