import type { SatoriOptions } from 'satori'
import type { JpegOptions } from 'sharp'
import type { FontConfig, OgImageRenderEventContext, Renderer, RuntimeFontConfig } from '../../../types'
import { tw4FontVars } from '#og-image-virtual/tw4-theme.mjs'
import compatibility from '#og-image/compatibility'
import resolvedFonts from '#og-image/fonts'
import { defu } from 'defu'
import { useOgImageRuntimeConfig } from '../../utils'
import { loadAllFonts, loadAllFontsDebug } from '../fonts'
import { useResvg, useSatori, useSharp } from './instances'
import { createVNodes } from './vnodes'

// Stable font array cache — satori uses a WeakMap keyed by array identity
const _satoriFontCache = new WeakMap<RuntimeFontConfig[], Array<RuntimeFontConfig & { name: string }>>()

// Capture Satori warnings during render
function withWarningCapture<T>(fn: () => Promise<T>): Promise<{ result: T, warnings: string[] }> {
  const warnings: string[] = []
  const originalWarn = console.warn
  console.warn = (...args: any[]) => {
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
    // Only capture Satori-related warnings (they start with WARN or contain CSS property names)
    if (msg.includes('WARN') || msg.includes('not supported') || msg.includes('Expected style'))
      warnings.push(msg.replace(/^\s*WARN\s*/, ''))
    originalWarn.apply(console, args)
  }
  return fn()
    .then(result => ({ result, warnings }))
    .finally(() => {
      console.warn = originalWarn
    })
}

export async function createSvg(event: OgImageRenderEventContext): Promise<{ svg: string | void, warnings: string[], fonts: RuntimeFontConfig[] }> {
  const { options } = event
  const { satoriOptions: _satoriOptions } = useOgImageRuntimeConfig()
  const fontFamilyOverride = (options.props as Record<string, any>)?.fontFamily
  // Always include the default font (first resolved, e.g. Lobster) so the wrapper div renders correctly
  const defaultFont = (resolvedFonts as FontConfig[])[0]?.family
  const [satori, vnodes, fonts] = await Promise.all([
    useSatori(),
    createVNodes(event),
    loadAllFonts(event.e, { supportsWoff2: false, component: options.component, fontFamilyOverride: fontFamilyOverride || defaultFont }),
  ])

  await event._nitro.hooks.callHook('nuxt-og-image:satori:vnodes', vnodes, event)
  // Remap to satori's font format (requires `name` instead of `family`).
  // Cache by source array reference so satori's WeakMap font cache hits.
  const satoriFonts = _satoriFontCache.get(fonts) ?? fonts.map(f => ({ ...f, name: f.family }))
  _satoriFontCache.set(fonts, satoriFonts)
  // Build tailwind theme from TW4 font vars, filtered to loaded font families
  // TW4 vars contain full font stacks (e.g. "ui-sans-serif, system-ui, ...") but Satori
  // can only use fonts that are actually loaded — filter to available families
  const loadedFamilies = new Set(satoriFonts.map(f => f.name))
  const defaultFamily = satoriFonts[0]?.name
  function resolveAvailableFamily(cssValue: string): string | undefined {
    const families = cssValue.split(',').map(f => f.trim().replace(/^['"]|['"]$/g, ''))
    const available = families.filter(f => loadedFamilies.has(f))
    if (available.length > 0)
      return available.join(', ')
    return defaultFamily
  }
  const fontFamily: Record<string, string> = {}
  for (const [key, val] of Object.entries(tw4FontVars)) {
    if (!key.startsWith('font-') || !val || !/[a-z]/i.test(val))
      continue
    const slot = key.slice(5) // 'font-sans' → 'sans', 'font-display' → 'display'
    const resolved = resolveAvailableFamily(val)
    if (resolved)
      fontFamily[slot] = resolved
  }
  const satoriOptions: SatoriOptions = defu(options.satori, _satoriOptions, <SatoriOptions>{
    fonts: satoriFonts,
    tailwindConfig: Object.keys(fontFamily).length ? { theme: { fontFamily } } : undefined,
    embedFont: true,
    width: options.width!,
    height: options.height!,
  }) as SatoriOptions

  const { result, warnings } = await withWarningCapture(() =>
    satori(vnodes, satoriOptions),
  )
  return { svg: result, warnings, fonts }
}

async function createPng(event: OgImageRenderEventContext) {
  const { resvgOptions } = useOgImageRuntimeConfig()
  const { svg } = await createSvg(event)
  if (!svg)
    throw new Error('Failed to create SVG')
  const options = defu(event.options.resvg, resvgOptions)
  const Resvg = await useResvg()
  const resvg = new Resvg(svg, options)
  const pngData = resvg.render()
  return pngData.asPng()
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
  const sharp = await useSharp().catch(() => {
    throw new Error('Sharp dependency could not be loaded. Please check you have it installed and are using a compatible runtime.')
  })
  const options = defu(event.options.sharp, sharpOptions)
  return sharp(svgBuffer, options)
    .jpeg(options as JpegOptions)
    .toBuffer()
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
        fonts: svgResult.fonts.map(f => ({
          family: f.family,
          weight: f.weight,
          style: f.style,
          src: f.src,
          satoriSrc: f.satoriSrc,
          size: f.data ? (f.data as ArrayBuffer).byteLength : 0,
        })),
      },
    }
  },
}

export default SatoriRenderer
