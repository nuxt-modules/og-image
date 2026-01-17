import { readFile } from 'node:fs/promises'
import { formatHex, parse, toGamut } from 'culori'
import { resolveModulePath } from 'exsolve'
import { dirname, join } from 'pathe'
import twColors from 'tailwindcss/colors'

// Gamut map oklch to sRGB using culori's toGamut
const toSrgbGamut = toGamut('rgb', 'oklch')

/**
 * Decode CSS selector escape sequences to get the actual class name.
 * Handles: .\32xl -> 2xl (hex escapes), .m-0\.5 -> m-0.5 (escaped chars)
 */
export function decodeCssClassName(selector: string): string {
  let className = selector.startsWith('.') ? selector.slice(1) : selector
  // Hex escapes: \32 -> '2'
  className = className.replace(/\\([0-9a-f]+)\s?/gi, (_, hex) =>
    String.fromCodePoint(Number.parseInt(hex, 16)))
  // Escaped special chars: \. -> .
  className = className.replace(/\\(.)/g, '$1')
  return className
}

/**
 * Create a stylesheet loader for the TW4 compiler.
 */
export function createStylesheetLoader(baseDir: string) {
  return async (id: string, base: string) => {
    // Handle tailwindcss import
    if (id === 'tailwindcss') {
      const twPath = resolveModulePath('tailwindcss/index.css', { from: baseDir })
      if (twPath) {
        const content = await readFile(twPath, 'utf-8').catch(() => '')
        if (content)
          return { path: twPath, base: dirname(twPath), content }
      }
      return {
        path: 'virtual:tailwindcss',
        base,
        content: '@layer theme, base, components, utilities;\n@layer utilities { @tailwind utilities; }',
      }
    }
    // Handle relative imports
    if (id.startsWith('./') || id.startsWith('../')) {
      const resolved = join(base || baseDir, id)
      const content = await readFile(resolved, 'utf-8').catch(() => '')
      return { path: resolved, base: dirname(resolved), content }
    }
    // Handle node_modules imports (e.g., @nuxt/ui)
    const resolved = resolveModulePath(id, { from: base || baseDir, conditions: ['style'] })
    if (resolved) {
      const content = await readFile(resolved, 'utf-8').catch(() => '')
      return { path: resolved, base: dirname(resolved), content }
    }
    return { path: id, base, content: '' }
  }
}

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
export function buildNuxtUiVars(
  vars: Map<string, string>,
  nuxtUiColors: Record<string, string>,
): void {
  const colors = twColors as unknown as Record<string, Record<number, string>>
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

  for (const [semantic, colorName] of Object.entries(nuxtUiColors)) {
    // Add color shades (e.g., --ui-color-primary-500)
    for (const shade of shades) {
      const varName = `--ui-color-${semantic}-${shade}`
      const value = colors[colorName]?.[shade]
      if (value && !vars.has(varName))
        vars.set(varName, value)
    }
    // Add semantic variable (e.g., --ui-primary)
    if (!vars.has(`--ui-${semantic}`))
      vars.set(`--ui-${semantic}`, colors[colorName]?.[500] || '')
  }

  // Add Nuxt UI semantic text/bg/border variables (light mode defaults)
  const neutral = nuxtUiColors.neutral || 'slate'
  const neutralColors = colors[neutral]
  const semanticVars: Record<string, string> = {
    '--ui-text-dimmed': neutralColors?.[400] || '',
    '--ui-text-muted': neutralColors?.[500] || '',
    '--ui-text-toned': neutralColors?.[600] || '',
    '--ui-text': neutralColors?.[700] || '',
    '--ui-text-highlighted': neutralColors?.[900] || '',
    '--ui-text-inverted': '#ffffff',
    '--ui-bg': '#ffffff',
    '--ui-bg-muted': neutralColors?.[50] || '',
    '--ui-bg-elevated': neutralColors?.[100] || '',
    '--ui-bg-accented': neutralColors?.[200] || '',
    '--ui-bg-inverted': neutralColors?.[900] || '',
    '--ui-border': neutralColors?.[200] || '',
    '--ui-border-muted': neutralColors?.[200] || '',
    '--ui-border-accented': neutralColors?.[300] || '',
    '--ui-border-inverted': neutralColors?.[900] || '',
  }
  for (const [name, value] of Object.entries(semanticVars)) {
    if (value && !vars.has(name))
      vars.set(name, value)
  }
}
