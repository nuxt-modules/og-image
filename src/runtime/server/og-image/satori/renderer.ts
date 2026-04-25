import type { SatoriOptions } from 'satori'
import type { JpegOptions } from 'sharp'
import type { OgImageRenderEventContext, Renderer, RuntimeFontConfig } from '../../../types'
import { defu } from 'defu'
import { tw4FontVars } from '#og-image-virtual/tw4-theme.mjs'
import compatibility from '#og-image/compatibility'
import { useOgImageRuntimeConfig } from '../../utils'
import { buildSubsetFamilyChain, extractCodepoints, getDefaultFontFamily, loadAllFontsDebug, loadFontsForRenderer, resolveSubsetChain } from '../fonts'
import { getResvg, getSatori, getSharp } from './instances'
import { createVNodes } from './vnodes'

// Stable font array cache — satori uses a WeakMap keyed by array identity
const _satoriFontCache = new WeakMap<RuntimeFontConfig[], Array<RuntimeFontConfig & { name: string }>>()

const RE_SATORI_WARN_PREFIX = /^\s*WARN\s*/
const RE_FONT_QUOTES = /^['"]|['"]$/g
const RE_ALPHA_CHAR = /[a-z]/i

// Capture Satori warnings during render
function withWarningCapture<T>(fn: () => Promise<T>): Promise<{ result: T, warnings: string[] }> {
  const warnings: string[] = []
  const originalWarn = console.warn
  console.warn = (...args: any[]) => {
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
    // Only capture Satori-related warnings (they start with WARN or contain CSS property names)
    if (msg.includes('WARN') || msg.includes('not supported') || msg.includes('Expected style'))
      warnings.push(msg.replace(RE_SATORI_WARN_PREFIX, ''))
    originalWarn.apply(console, args)
  }
  return fn()
    .then(result => ({ result, warnings }))
    .finally(() => {
      console.warn = originalWarn
    })
}

export async function createSvg(event: OgImageRenderEventContext): Promise<{ svg: string | void, warnings: string[], fonts: RuntimeFontConfig[] }> {
  const { options, timings } = event
  const { satoriOptions: _satoriOptions } = useOgImageRuntimeConfig()
  const { fontFamilyOverride, defaultFont } = getDefaultFontFamily(options)
  const [satori, vnodes] = await Promise.all([
    getSatori(),
    createVNodes(event),
  ])
  const codepoints = extractCodepoints(vnodes)
  const hasCustomFonts = Array.isArray(options.fonts) && options.fonts.length > 0
  const fonts = await timings.measure('font-load', () => loadFontsForRenderer(event, {
    supportedFormats: new Set(['ttf', 'otf', 'woff'] as const),
    component: options.component,
    fontFamilyOverride: fontFamilyOverride || defaultFont,
    codepoints,
    fontDefs: options.fonts,
  }))

  await event._nitro.hooks.callHook('nuxt-og-image:satori:vnodes', vnodes, event)
  // Remap to satori's font format (requires `name` instead of `family`).
  // Use WeakMap cache only for base fonts (stable reference from fontArrayCache).
  // Custom font arrays are per-request so can't benefit from identity caching.
  const satoriFonts = (!hasCustomFonts && _satoriFontCache.get(fonts)) || fonts.map(f => ({ ...f, name: f.family }))
  if (!hasCustomFonts)
    _satoriFontCache.set(fonts, satoriFonts)

  // Build subset family chains for fonts that were split into unicode-range subsets
  const subsetChains = buildSubsetFamilyChain(fonts)

  // Build tailwind theme from TW4 font vars, filtered to loaded font families.
  // TW4 vars contain full font stacks (e.g. "ui-sans-serif, system-ui, ...") but Satori
  // can only use fonts that are actually loaded — filter to available families.
  // For subset fonts, expand original family names into the full subset chain.
  const loadedFamilies = new Set(satoriFonts.map(f => f.name))
  const defaultFamily = satoriFonts[0]?.name
  function resolveAvailableFamily(cssValue: string): string | undefined {
    const families = cssValue.split(',').map(f => f.trim().replace(RE_FONT_QUOTES, ''))
    const resolved: string[] = []
    for (const f of families) {
      if (loadedFamilies.has(f)) {
        resolved.push(f)
        continue
      }
      const chain = resolveSubsetChain(f, subsetChains)
      if (chain)
        resolved.push(...chain)
    }
    if (resolved.length > 0)
      return resolved.join(', ')
    return defaultFamily
  }
  const fontFamily: Record<string, string> = {}
  for (const [key, val] of Object.entries(tw4FontVars)) {
    if (!key.startsWith('font-') || !val || !RE_ALPHA_CHAR.test(val))
      continue
    const slot = key.slice(5) // 'font-sans' → 'sans', 'font-display' → 'display'
    const resolved = resolveAvailableFamily(val)
    if (resolved)
      fontFamily[slot] = resolved
  }
  // Rewrite inline fontFamily in vnodes to use subset chains
  if (subsetChains.size > 0)
    rewriteVNodeFontFamilies(vnodes, subsetChains)

  const satoriOptions: SatoriOptions = defu(options.satori, _satoriOptions, <SatoriOptions>{
    fonts: satoriFonts,
    tailwindConfig: Object.keys(fontFamily).length ? { theme: { fontFamily } } : undefined,
    embedFont: true,
    width: options.width!,
    height: options.height!,
  }) as SatoriOptions

  const { result, warnings } = await timings.measure('render-satori', () => withWarningCapture(() =>
    satori(vnodes, satoriOptions),
  ))
  return { svg: result, warnings, fonts }
}

async function createPng(event: OgImageRenderEventContext) {
  const { resvgOptions } = useOgImageRuntimeConfig()
  const { svg } = await createSvg(event)
  if (!svg)
    throw new Error('Failed to create SVG')
  const options = defu(event.options.resvg, resvgOptions)
  const Resvg = await getResvg()
  return event.timings.measure('render-resvg', () => {
    const resvg = new Resvg(svg, options)
    const pngData = resvg.render()
    const png = pngData.asPng()
    // Free WASM resources when using @resvg/resvg-wasm (no-op for native binding)
    if (typeof (pngData as any).free === 'function')
      (pngData as any).free()
    if (typeof (resvg as any).free === 'function')
      (resvg as any).free()
    return png
  })
}

async function createJpeg(event: OgImageRenderEventContext) {
  const { sharpOptions } = useOgImageRuntimeConfig()
  if (compatibility.sharp === false) {
    throw new Error('Sharp dependency is not accessible. Please check you have it installed and are using a compatible runtime.')
  }
  const { svg } = await createSvg(event)
  if (!svg) {
    throw new Error('Failed to create SVG for JPEG rendering.')
  }
  const svgBuffer = Buffer.from(svg)
  const sharp = await getSharp().catch(() => {
    throw new Error('Sharp dependency could not be loaded. Please check you have it installed and are using a compatible runtime.')
  })
  const options = defu(event.options.sharp, sharpOptions)
  return event.timings.measure('render-sharp', () => sharp(svgBuffer, options)
    .jpeg(options as JpegOptions)
    .toBuffer())
}

/**
 * Walk the satori VNode tree and rewrite fontFamily values to use subset chains.
 * E.g., `fontFamily: "Noto Sans SC"` → `fontFamily: "Noto Sans SC__0, Noto Sans SC__1, ..."`
 */
function rewriteVNodeFontFamilies(node: any, subsetChains: Map<string, string[]>) {
  const style = node.props?.style
  if (style?.fontFamily && typeof style.fontFamily === 'string') {
    const families = style.fontFamily.split(',').map((f: string) => f.trim().replace(RE_FONT_QUOTES, ''))
    const resolved: string[] = []
    for (const f of families) {
      const chain = resolveSubsetChain(f, subsetChains)
      if (chain)
        resolved.push(...chain)
      else
        resolved.push(f)
    }
    style.fontFamily = resolved.join(', ')
  }
  const children = node.props?.children
  if (Array.isArray(children)) {
    for (const child of children) {
      if (child && typeof child === 'object')
        rewriteVNodeFontFamilies(child, subsetChains)
    }
  }
}

const SatoriRenderer: Renderer = {
  name: 'satori',
  supportedFormats: ['png', 'jpeg', 'jpg', 'json'],
  async createImage(e) {
    switch (e.extension) {
      case 'png':
        return createPng(e)
      case 'jpeg':
      case 'jpg':
        return createJpeg(e)
    }
  },
  async debug(e) {
    const [vnodes, svgResult] = await Promise.all([
      createVNodes(e),
      createSvg(e),
    ])
    return {
      vnodes,
      svg: svgResult.svg,
      warnings: svgResult.warnings,
      fontDebug: {
        ...loadAllFontsDebug(e.options.component),
        fonts: svgResult.fonts.map(({ data: _, ...f }) => ({
          ...f,
          size: _.byteLength,
        })),
      },
    }
  },
}

export default SatoriRenderer
