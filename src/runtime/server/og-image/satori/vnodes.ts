import type { FontConfig, OgImageRenderEventContext, VNode } from '../../../types'
import resolvedFonts from '#og-image/fonts'
import { walkTree } from '../core/plugins'
import { createVNodes as coreCreateVNodes } from '../core/vnodes'
import classes from './plugins/classes'
import emojis from './plugins/emojis'
import flex from './plugins/flex'
import nuxtIcon from './plugins/nuxt-icon'

// Re-export shared utilities for external consumers
export { htmlToVNode, SVG_CAMEL_ATTR_VALUES, warnUnsupportedSvgElements } from '../core/vnodes'

// Get default font family from resolved fonts
function getDefaultFontFamily(): string {
  const fonts = resolvedFonts as FontConfig[]
  const firstFont = fonts[0]
  if (firstFont)
    return `'${firstFont.family}', sans-serif`
  return 'sans-serif'
}

export async function createVNodes(ctx: OgImageRenderEventContext): Promise<VNode> {
  const fontFamilyOverride = (ctx.options.props as Record<string, any>)?.fontFamily
  const font = fontFamilyOverride ? `'${fontFamilyOverride}', sans-serif` : getDefaultFontFamily()
  const vnodes = await coreCreateVNodes(ctx, { wrapperStyle: `font-family: ${font};` })
  // satori-only sync transforms
  walkTree(ctx, vnodes, [classes, flex, nuxtIcon])
  // satori-only async transforms
  await Promise.all(walkTree(ctx, vnodes, [emojis]))
  return vnodes
}
