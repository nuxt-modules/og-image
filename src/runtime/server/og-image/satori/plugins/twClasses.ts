import type { VNode } from '../../../../types'
import { tw4Breakpoints } from '#og-image-virtual/tw4-theme.mjs'
import { defineSatoriTransformer } from '../utils'

// Default Tailwind breakpoints (fallback if not extracted from TW4 CSS)
const DEFAULT_BREAKPOINTS: Record<string, number> = {
  'sm': 640,
  'md': 768,
  'lg': 1024,
  'xl': 1280,
  '2xl': 1536,
}

// Merge extracted breakpoints with defaults
const BREAKPOINTS = { ...DEFAULT_BREAKPOINTS, ...tw4Breakpoints }

const RESPONSIVE_PREFIX_RE = /^(sm|md|lg|xl|2xl):(.+)$/
const DARK_MODE_PREFIX_RE = /^dark:(.+)$/

// Convert class prop to tw prop for Satori, handling responsive breakpoints and dark mode
// Note: TW4 class transformations and unsupported class filtering happen at build time via AssetTransformPlugin
export default defineSatoriTransformer({
  filter: (node: VNode) => !!node.props?.class,
  transform: (node: VNode, ctx) => {
    const classes: string = node.props.class || ''
    const renderWidth = Number(ctx.options.width) || 1200
    const isDarkMode = (ctx.options.props as Record<string, any>)?.colorMode === 'dark'

    const processedClasses: string[] = []

    for (const token of classes.split(' ').filter(c => c.trim())) {
      // Check for dark mode prefix first
      const darkMatch = token.match(DARK_MODE_PREFIX_RE)
      if (darkMatch) {
        // Dark mode class - only include if colorMode is dark
        if (isDarkMode) {
          // Strip dark: prefix and process the remaining class
          const baseClass = darkMatch[1]!
          // Check if the base class also has a responsive prefix
          const respMatch = baseClass.match(RESPONSIVE_PREFIX_RE)
          if (respMatch) {
            const bp = respMatch[1]!
            const finalClass = respMatch[2]!
            const breakpointWidth = BREAKPOINTS[bp]
            if (breakpointWidth && renderWidth >= breakpointWidth) {
              processedClasses.push(finalClass)
            }
          }
          else {
            processedClasses.push(baseClass)
          }
        }
        // else: not dark mode, skip dark: classes
        continue
      }

      // Check for responsive prefix
      const respMatch = token.match(RESPONSIVE_PREFIX_RE)
      if (respMatch) {
        // Responsive class - check if breakpoint applies
        const bp = respMatch[1]!
        const baseClass = respMatch[2]!
        const breakpointWidth = BREAKPOINTS[bp]

        if (breakpointWidth && renderWidth >= breakpointWidth) {
          // Breakpoint applies - use the base class (strip prefix)
          processedClasses.push(baseClass)
        }
        // else: breakpoint doesn't apply, skip this class
      }
      else {
        // Non-responsive class - keep as-is (already transformed at build time)
        processedClasses.push(token)
      }
    }

    const twClasses = processedClasses.join(' ')
    node.props.tw = twClasses
    node.props.class = twClasses
  },
})
