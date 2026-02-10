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
