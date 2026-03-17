import type { FontConfig, OgImageRenderEventContext, VNode } from '../../../types'
import resolvedFonts from '#og-image/fonts'
import { walkTree } from '../core/plugins'
import { createVNodes as coreCreateVNodes, resolveSvgDimension } from '../core/vnodes'
import classes from './plugins/classes'
import emojis from './plugins/emojis'
import flex from './plugins/flex'
import nuxtIcon from './plugins/nuxt-icon'

// Re-export shared utilities for external consumers
export { htmlToVNode, resolveSvgDimension, SVG_CAMEL_ATTR_VALUES, warnUnsupportedSvgElements } from '../core/vnodes'

// Get default font family from resolved fonts
function getDefaultFontFamily(): string {
  const fonts = resolvedFonts as FontConfig[]
  const firstFont = fonts[0]
  if (firstFont)
    return `'${firstFont.family}', sans-serif`
  return 'sans-serif'
}

const RE_PX = /^(\d+(?:\.\d+)?)px$/

/**
 * Satori embeds inline <svg> as data URI <image> elements, resolving width/height
 * attributes to pixel values. Percentage values (width="100%") become NaN.
 * This walk uses the shared resolveSvgDimension (attrs → style → viewBox),
 * then falls back to the nearest ancestor with explicit pixel dimensions.
 */
function findAncestorPxDim(ancestors: VNode[], prop: 'width' | 'height'): number | undefined {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const s = ancestors[i]!.props?.style
    if (s) {
      const v = typeof s[prop] === 'string' ? s[prop].match(RE_PX)?.[1] : undefined
      if (v)
        return Number(v)
    }
  }
}

const RE_PERCENT = /^\d+%$/

function resolveSvgPercentDimensions(node: VNode, ancestors: VNode[] = []) {
  if (node.type === 'svg') {
    for (const dim of ['width', 'height'] as const) {
      const val = String(node.props?.[dim] || '')
      const isPercent = RE_PERCENT.test(val)
      if (isPercent) {
        // Percentage → prefer ancestor container px, fall back to viewBox
        const resolved = findAncestorPxDim(ancestors, dim) ?? resolveSvgDimension(node.props, node.props?.style, dim)
        if (resolved)
          node.props[dim] = resolved
      }
      // Don't resolve relative units (em/rem) — satori handles these natively
    }
  }
  if (Array.isArray(node.props?.children)) {
    ancestors.push(node)
    for (const child of node.props.children) {
      if (child && typeof child === 'object')
        resolveSvgPercentDimensions(child, ancestors)
    }
    ancestors.pop()
  }
}

export async function createVNodes(ctx: OgImageRenderEventContext): Promise<VNode> {
  const fontFamilyOverride = (ctx.options.props as Record<string, any>)?.fontFamily
  const font = fontFamilyOverride ? `'${fontFamilyOverride}', sans-serif` : getDefaultFontFamily()
  const vnodes = await coreCreateVNodes(ctx, { wrapperStyle: `font-family: ${font};` })
  // satori-only sync transforms
  walkTree(ctx, vnodes, [classes, flex, nuxtIcon])
  // satori-only async transforms
  await Promise.all(walkTree(ctx, vnodes, [emojis]))
  // Resolve SVG percentage dimensions to parent pixel values (satori can't handle %)
  resolveSvgPercentDimensions(vnodes)
  return vnodes
}
