import type { VNode } from '../../../../types'
import { tw4Breakpoints } from '#og-image-virtual/tw4-theme.mjs'
import { defineTransformer } from '../plugins'

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
const GAP_CLASS_RE = /^gap(?:-(x|y))?-(\d+(?:\.\d+)?)$/
const GAP_ARBITRARY_RE = /^gap(?:-(x|y))?-\[(.+)\]$/

// Resolve gap class to inline style (Satori wants literal values)
function resolveGapToStyle(cls: string, style: Record<string, any>): boolean {
  const match = cls.match(GAP_CLASS_RE)
  if (match) {
    const axis = match[1]
    const value = Number(match[2])
    if (axis === 'x')
      style.columnGap = value
    else if (axis === 'y')
      style.rowGap = value
    else style.gap = value
    return true
  }
  const arbMatch = cls.match(GAP_ARBITRARY_RE)
  if (arbMatch) {
    const axis = arbMatch[1]
    const value = arbMatch[2]!
    if (axis === 'x')
      style.columnGap = value
    else if (axis === 'y')
      style.rowGap = value
    else style.gap = value
    return true
  }
  return false
}

const DISPLAY_CLASSES = new Set([
  'hidden',
  'block',
  'flex',
  'grid',
  'inline',
  'inline-flex',
  'inline-block',
  'inline-grid',
  'contents',
  'table',
  'flow-root',
  'list-item',
])

// Groups of utilities that conflict with each other
const OVERLOADED_GROUPS: [string, (value: string) => string][] = [
  ['text-', v => /^(?:xs|sm|base|lg|xl|\d+xl)$/.test(v) ? 'text-size' : 'text-color'],
  ['border-', v => /^\d+$/.test(v) || /^[trblxy](?:-\d+)?$/.test(v) ? 'border-width' : 'border-color'],
  ['ring-', v => /^\d+$/.test(v) ? 'ring-width' : 'ring-color'],
  ['divide-', v => /^[xy](?:-\d+)?$/.test(v) || /^\d+$/.test(v) || v === 'reverse' ? 'divide-width' : 'divide-color'],
  ['outline-', v => /^\d+$/.test(v) || /^(?:none|dashed|dotted|double)$/.test(v) ? 'outline-style' : 'outline-color'],
]

/**
 * Extract the TW utility group from a class name for conflict detection.
 */
function getUtilityGroup(cls: string): string {
  if (DISPLAY_CLASSES.has(cls))
    return 'display'
  if (cls.includes('['))
    return `${cls.slice(0, cls.indexOf('['))}-arbitrary`

  for (const [prefix, resolver] of OVERLOADED_GROUPS) {
    if (cls === prefix.slice(0, -1) || cls.startsWith(prefix)) {
      return resolver(cls.slice(prefix.length))
    }
  }

  const dashIdx = cls.indexOf('-')
  return dashIdx === -1 ? cls : cls.slice(0, dashIdx)
}

// Resolve a dark: token into a final class (handling nested responsive prefixes).
// Returns the resolved class or null if the responsive breakpoint doesn't apply.
function resolveDarkToken(baseClass: string, renderWidth: number): string | null {
  const respMatch = baseClass.match(RESPONSIVE_PREFIX_RE)
  if (respMatch) {
    const bp = respMatch[1]!
    const finalClass = respMatch[2]!
    const breakpointWidth = BREAKPOINTS[bp]
    return (breakpointWidth && renderWidth >= breakpointWidth) ? finalClass : null
  }
  return baseClass
}

// Resolve style directives: responsive breakpoints, dark mode, and gap classes
// Note: TW4 class transformations and unsupported class filtering happen at build time via AssetTransformPlugin
export default defineTransformer({
  filter: (node: VNode) => !!node.props?.class,
  transform: (node: VNode, ctx) => {
    const classes: string = node.props.class || ''
    const renderWidth = Number(ctx.options.width) || 1200
    const isDarkMode = (ctx.options.props as Record<string, any>)?.colorMode === 'dark'

    const tokens = classes.split(' ').filter(c => c.trim())

    // Pass 1: collect utility groups that have responsive or dark: overrides
    // so we can exclude conflicting base classes (satori doesn't handle CSS cascade order)
    const darkOverrideGroups = new Set<string>()
    const responsiveOverrideGroups = new Set<string>()

    for (const token of tokens) {
      // Dark mode overrides
      if (isDarkMode) {
        const darkMatch = token.match(DARK_MODE_PREFIX_RE)
        if (darkMatch) {
          const resolved = resolveDarkToken(darkMatch[1]!, renderWidth)
          if (resolved)
            darkOverrideGroups.add(getUtilityGroup(resolved))
          continue
        }
      }
      // Responsive overrides (e.g. lg:flex should override base hidden)
      const respMatch = token.match(RESPONSIVE_PREFIX_RE)
      if (respMatch) {
        const bp = respMatch[1]!
        const baseClass = respMatch[2]!
        const breakpointWidth = BREAKPOINTS[bp]
        if (breakpointWidth && renderWidth >= breakpointWidth)
          responsiveOverrideGroups.add(getUtilityGroup(baseClass))
      }
    }

    // Pass 2: process all tokens
    const processedClasses: string[] = []
    const gapStyles: Record<string, any> = {}

    for (const token of tokens) {
      // Check for dark mode prefix first
      const darkMatch = token.match(DARK_MODE_PREFIX_RE)
      if (darkMatch) {
        if (isDarkMode) {
          const resolved = resolveDarkToken(darkMatch[1]!, renderWidth)
          if (resolved) {
            if (!resolveGapToStyle(resolved, gapStyles))
              processedClasses.push(resolved)
          }
        }
        continue
      }

      // Check for responsive prefix
      const respMatch = token.match(RESPONSIVE_PREFIX_RE)
      if (respMatch) {
        const bp = respMatch[1]!
        const baseClass = respMatch[2]!
        const breakpointWidth = BREAKPOINTS[bp]

        if (breakpointWidth && renderWidth >= breakpointWidth) {
          // Skip if overridden by a dark: class
          if (isDarkMode && darkOverrideGroups.has(getUtilityGroup(baseClass)))
            continue
          if (!resolveGapToStyle(baseClass, gapStyles))
            processedClasses.push(baseClass)
        }
      }
      else {
        const group = getUtilityGroup(token)
        // Skip base classes overridden by dark: or responsive variants
        if ((isDarkMode && darkOverrideGroups.has(group)) || responsiveOverrideGroups.has(group))
          continue
        if (!resolveGapToStyle(token, gapStyles))
          processedClasses.push(token)
      }
    }

    // Merge gap styles into node's inline style
    if (Object.keys(gapStyles).length > 0) {
      node.props.style = { ...node.props.style, ...gapStyles }
    }

    node.props.class = processedClasses.join(' ')
  },
})
