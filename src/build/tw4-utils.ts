import { formatHex, parse, toGamut } from 'culori'

// Gamut map oklch to sRGB using culori's toGamut
const toSrgbGamut = toGamut('rgb', 'oklch')

/**
 * Convert any CSS color to hex with proper gamut mapping for oklch.
 * Returns original value if parsing fails or contains var().
 */
export function convertColorToHex(value: string): string {
  if (!value || value.includes('var('))
    return value
  const color = parse(value)
  if (!color)
    return value
  const mapped = toSrgbGamut(color)
  return formatHex(mapped) || value
}

/**
 * Convert oklch colors in a CSS string to hex.
 */
export function convertOklchToHex(css: string): string {
  return css.replace(/oklch\([^)]+\)/g, match => convertColorToHex(match))
}

/**
 * CSS properties that contain colors (need oklch→hex conversion)
 */
export const COLOR_PROPERTIES = new Set([
  'color',
  'background-color',
  'background-image',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'fill',
  'stroke',
  'text-decoration-color',
  'caret-color',
  'accent-color',
])

/**
 * Build Nuxt UI CSS variable declarations.
 * Expands semantic color names (e.g., { primary: 'indigo' }) to full CSS variable sets.
 */
export async function buildNuxtUiVars(
  vars: Map<string, string>,
  nuxtUiColors: Record<string, string>,
): Promise<void> {
  const twColors = await import('tailwindcss/colors').then(m => m.default) as Record<string, Record<number, string>>
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

  for (const [semantic, twColor] of Object.entries(nuxtUiColors)) {
    // Add color shades (e.g., --ui-color-primary-500)
    for (const shade of shades) {
      const varName = `--ui-color-${semantic}-${shade}`
      const value = twColors[twColor]?.[shade]
      if (value && !vars.has(varName))
        vars.set(varName, value)
    }
    // Add semantic variable (e.g., --ui-primary)
    if (!vars.has(`--ui-${semantic}`))
      vars.set(`--ui-${semantic}`, twColors[twColor]?.[500] || '')
  }

  // Add Nuxt UI semantic text/bg/border variables (light mode defaults)
  const neutral = nuxtUiColors.neutral || 'slate'
  const semanticVars: Record<string, string> = {
    '--ui-text-dimmed': twColors[neutral]?.[400] || '',
    '--ui-text-muted': twColors[neutral]?.[500] || '',
    '--ui-text-toned': twColors[neutral]?.[600] || '',
    '--ui-text': twColors[neutral]?.[700] || '',
    '--ui-text-highlighted': twColors[neutral]?.[900] || '',
    '--ui-text-inverted': '#ffffff',
    '--ui-bg': '#ffffff',
    '--ui-bg-muted': twColors[neutral]?.[50] || '',
    '--ui-bg-elevated': twColors[neutral]?.[100] || '',
    '--ui-bg-accented': twColors[neutral]?.[200] || '',
    '--ui-bg-inverted': twColors[neutral]?.[900] || '',
    '--ui-border': twColors[neutral]?.[200] || '',
    '--ui-border-muted': twColors[neutral]?.[200] || '',
    '--ui-border-accented': twColors[neutral]?.[300] || '',
    '--ui-border-inverted': twColors[neutral]?.[900] || '',
  }
  for (const [name, value] of Object.entries(semanticVars)) {
    if (value && !vars.has(name))
      vars.set(name, value)
  }
}
