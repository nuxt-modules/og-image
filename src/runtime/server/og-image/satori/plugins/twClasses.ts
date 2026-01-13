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

// Convert class prop to tw prop for Satori, handling responsive breakpoints
// Note: TW4 class transformations and unsupported class filtering happen at build time via AssetTransformPlugin
export default defineSatoriTransformer({
  filter: (node: VNode) => !!node.props?.class,
  transform: (node: VNode, ctx) => {
    const classes: string = node.props.class || ''
    const renderWidth = Number(ctx.options.width) || 1200

    const processedClasses: string[] = []

    for (const token of classes.split(' ').filter(c => c.trim())) {
      const match = token.match(RESPONSIVE_PREFIX_RE)

      if (match) {
        // Responsive class - check if breakpoint applies
        const bp = match[1]!
        const baseClass = match[2]!
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
