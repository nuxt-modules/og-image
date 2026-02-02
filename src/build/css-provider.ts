import type { Nuxt } from '@nuxt/schema'
import { resolveModulePath } from 'exsolve'

export interface CssProvider {
  name: 'tailwind' | 'unocss'
  /**
   * Resolve utility classes to inline styles for Satori.
   * @param classes Array of class names to resolve
   * @returns Map of class name → CSS properties (kebab-case)
   */
  resolveClassesToStyles: (classes: string[]) => Promise<Record<string, Record<string, string>>>
  /**
   * Extract theme metadata (fonts, breakpoints, colors).
   */
  extractMetadata?: () => Promise<CssMetadata>
  /**
   * Clear cached compiler state (for HMR).
   */
  clearCache?: () => void
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
