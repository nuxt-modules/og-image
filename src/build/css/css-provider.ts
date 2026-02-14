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
