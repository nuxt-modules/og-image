import type { Nuxt } from '@nuxt/schema'
import { resolveModulePath } from 'exsolve'

export interface CssProvider {
  name: 'tailwind' | 'unocss'
  /**
   * Resolve utility classes to inline styles for Satori.
   * @param classes Array of class names to resolve
   * @returns Map of class name → CSS properties (kebab-case) or string class rewrite
   */
  resolveClassesToStyles: (classes: string[], context?: string, rootAttrs?: Record<string, string>) => Promise<Record<string, Record<string, string> | string>>
  /**
   * Extract theme metadata (fonts, breakpoints, colors).
   */
  extractMetadata?: () => Promise<CssMetadata>
  /**
   * Get the resolved CSS variable map for resolving var() in attributes.
   */
  getVars?: (rootAttrs?: Record<string, string>) => Promise<Map<string, string>>
  /**
   * Clear cached user CSS vars only (for HMR when CSS files change).
   */
  clearUserVarsCache?: () => void
  /**
   * Clear all cached state including compiler (for HMR when config changes).
   */
  clearCache?: () => void
  /**
   * Resolve a custom icon by prefix and name (e.g. from UnoCSS presetIcons collections).
   * Returns the SVG body and dimensions, or null if not found.
   */
  resolveIcon?: (prefix: string, name: string) => Promise<{ body: string, width: number, height: number } | null>
}

export interface CssMetadata {
  fontVars?: Record<string, string>
  breakpoints?: Record<string, number>
  colors?: Record<string, string | Record<string, string>>
}

// ============================================================================
// Shared variant prefix handling (used by both TW4 and UnoCSS providers)
// ============================================================================

export const VARIANT_PREFIX_RE = /^((?:sm|md|lg|xl|2xl|dark):)(.+)$/

// Map CSS property → utility prefix for arbitrary value rewriting
const CSS_PROP_TO_UTILITY_PREFIX: Record<string, string> = {
  'background-color': 'bg',
  'color': 'text',
  'border-color': 'border',
  'font-size': 'text',
  'font-weight': 'font',
  'line-height': 'leading',
  'letter-spacing': 'tracking',
  'opacity': 'opacity',
  'width': 'w',
  'height': 'h',
  'max-width': 'max-w',
  'max-height': 'max-h',
  'min-width': 'min-w',
  'min-height': 'min-h',
  'border-radius': 'rounded',
  'gap': 'gap',
  'padding': 'p',
  'padding-top': 'pt',
  'padding-right': 'pr',
  'padding-bottom': 'pb',
  'padding-left': 'pl',
  'margin': 'm',
  'margin-top': 'mt',
  'margin-right': 'mr',
  'margin-bottom': 'mb',
  'margin-left': 'ml',
  'display': '',
}

/**
 * Convert a single-property resolved style back to an arbitrary value class.
 * Returns undefined for multi-property classes or unmapped properties.
 */
export function stylesToArbitraryClass(styles: Record<string, string>): string | undefined {
  const entries = Object.entries(styles)
  if (entries.length !== 1)
    return undefined
  const [prop, value] = entries[0]!
  if (prop === 'display')
    return value === 'none' ? 'hidden' : value
  const prefix = CSS_PROP_TO_UTILITY_PREFIX[prop]
  if (!prefix)
    return undefined
  return `${prefix}-[${value}]`
}

/**
 * Extract base class names from variant-prefixed classes.
 * e.g., ['md:bg-blue-500', 'text-red'] → Set('bg-blue-500')
 */
export function extractVariantBaseClasses(classes: string[]): Set<string> {
  const baseClasses = new Set<string>()
  for (const cls of classes) {
    const m = cls.match(VARIANT_PREFIX_RE)
    if (m?.[2])
      baseClasses.add(m[2])
  }
  return baseClasses
}

/**
 * Apply variant-prefix-aware resolution to a set of classes.
 * Prefixed classes are rewritten to arbitrary classes; base classes that conflict
 * with prefixed variants are kept as class rewrites for runtime resolution.
 */
export function resolveVariantPrefixes(
  classes: string[],
  resolvedStyles: Map<string, Record<string, string>>,
): Record<string, Record<string, string> | string> {
  // Collect CSS properties overridden by prefixed variants
  const prefixOverrideProps = new Set<string>()
  for (const cls of classes) {
    const prefixMatch = cls.match(VARIANT_PREFIX_RE)
    if (prefixMatch) {
      const baseStyles = resolvedStyles.get(prefixMatch[2]!)
      if (baseStyles) {
        for (const prop of Object.keys(baseStyles))
          prefixOverrideProps.add(prop)
      }
    }
  }

  const result: Record<string, Record<string, string> | string> = {}

  for (const cls of classes) {
    // Responsive/dark prefixed classes: resolve base value but keep as class for runtime
    const prefixMatch = cls.match(VARIANT_PREFIX_RE)
    if (prefixMatch) {
      const [, prefix, baseClass] = prefixMatch
      const baseStyles = resolvedStyles.get(baseClass!)
      if (baseStyles) {
        const arbitrary = stylesToArbitraryClass(baseStyles)
        result[cls] = arbitrary ? `${prefix}${arbitrary}` : cls
      }
      else {
        result[cls] = cls
      }
      continue
    }

    const styles = resolvedStyles.get(cls)
    if (styles) {
      // If a prefixed variant overrides any of this class's properties,
      // keep as class rewrite so runtime styleDirectives can resolve the conflict
      const hasConflict = Object.keys(styles).some(prop => prefixOverrideProps.has(prop))
      if (hasConflict) {
        const arbitrary = stylesToArbitraryClass(styles)
        result[cls] = arbitrary || cls
      }
      else {
        result[cls] = styles
      }
    }
  }

  return result
}

/**
 * Detect which CSS framework is being used.
 * Priority: @unocss/nuxt module → tailwindcss package
 */
export function detectCssProvider(nuxt: Nuxt): 'tailwind' | 'unocss' | null {
  const modules = nuxt.options.modules.flat()

  // Check for @unocss/nuxt module
  if (modules.some(m => typeof m === 'string' && m.includes('@unocss/nuxt')))
    return 'unocss'

  // Check for tailwindcss package
  if (resolveModulePath('tailwindcss', { from: nuxt.options.rootDir }))
    return 'tailwind'

  return null
}
