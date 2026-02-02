import type { TemplateChildNode } from '@vue/compiler-core'
import { formatHex, parse, toGamut } from 'culori'

// Gamut map oklch to sRGB using culori's toGamut
const toSrgbGamut = toGamut('rgb', 'oklch')

// ============================================================================
// Postcss lazy loading (shared between providers)
// ============================================================================

let postcss: typeof import('postcss').default
let postcssCalc: (opts?: object) => import('postcss').Plugin

export async function loadPostcss() {
  if (!postcss) {
    const [postcssModule, postcssCalcModule] = await Promise.all([
      import('postcss'),
      import('postcss-calc'),
    ])
    postcss = postcssModule.default
    postcssCalc = postcssCalcModule.default as unknown as typeof postcssCalc
  }
  return { postcss, postcssCalc }
}

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
 * Walk Vue template AST nodes recursively.
 */
export function walkTemplateAst(
  nodes: TemplateChildNode[],
  visitor: (node: TemplateChildNode) => void,
): void {
  for (const node of nodes) {
    visitor(node)
    if ('children' in node && Array.isArray(node.children))
      walkTemplateAst(node.children as TemplateChildNode[], visitor)
  }
}
