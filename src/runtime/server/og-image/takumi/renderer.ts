import type { FontConfig, OgImageRenderEventContext, Renderer } from '../../../types'
import resolvedFonts from '#og-image/fonts'
import { getNitroOrigin } from '#site-config/server/composables'
import { defu } from 'defu'
import { withBase } from 'ufo'
import { logger } from '../../../logger'
import { extractCodepointsFromTakumiNodes, loadAllFonts } from '../fonts'
import { useExtractResourceUrls, useTakumi } from './instances'
import { createTakumiNodes } from './nodes'
import { sanitizeTakumiStyles } from './sanitize'

interface TakumiState {
  renderer: any
  loadedFontKeys: Set<string>
  familySubsetNames: Map<string, string[]>
  subsetCounter: number
}

async function useTakumiState(event: OgImageRenderEventContext): Promise<TakumiState> {
  const nitro = event._nitro as any
  if (nitro._takumiState)
    return nitro._takumiState
  const Renderer = await useTakumi()
  nitro._takumiState = {
    renderer: new Renderer(),
    loadedFontKeys: new Set(),
    familySubsetNames: new Map(),
    subsetCounter: 0,
  } satisfies TakumiState
  return nitro._takumiState
}

async function loadFontsIntoRenderer(state: TakumiState, fonts: Array<{ family: string, data?: BufferSource, weight?: number, style?: string, cacheKey?: string }>) {
  for (const font of fonts) {
    if (!font.data)
      continue
    const uniqueKey = font.cacheKey || `${font.family}-${font.weight}-${font.style}`
    if (state.loadedFontKeys.has(uniqueKey))
      continue

    const fontData = font.data instanceof ArrayBuffer
      ? new Uint8Array(font.data)
      : Uint8Array.from(font.data as Uint8Array)

    const subsetName = `${font.family}__${state.subsetCounter++}`
    try {
      await state.renderer.loadFont({
        name: subsetName,
        data: fontData,
        weight: font.weight,
        style: font.style as 'normal' | 'italic' | 'oblique',
      })
      if (!state.familySubsetNames.has(font.family))
        state.familySubsetNames.set(font.family, [])
      state.familySubsetNames.get(font.family)!.push(subsetName)
    }
    catch (err) {
      logger.warn(`Failed to load font "${font.family}" (weight: ${font.weight}) into takumi renderer: ${(err as Error).message}`)
    }
    state.loadedFontKeys.add(uniqueKey)
  }
}

function rewriteFontFamilies(node: any, familySubsetNames: Map<string, string[]>) {
  if (node.style?.fontFamily) {
    const families = node.style.fontFamily.split(',').map((f: string) => f.trim().replace(/['"]/g, ''))
    const expanded = families.flatMap((f: string) => familySubsetNames.get(f) || [f])
    // Append all other loaded font subsets as fallback for missing glyphs.
    // Without this, an element styled with e.g. font-family: 'Poppins' would
    // have no fallback when Poppins lacks glyphs (e.g. Devanagari script) —
    // the renderer needs other loaded fonts in the font stack to fall back to.
    const expandedSet = new Set(expanded)
    for (const subsets of familySubsetNames.values()) {
      for (const name of subsets) {
        if (!expandedSet.has(name)) {
          expanded.push(name)
          expandedSet.add(name)
        }
      }
    }
    node.style.fontFamily = expanded.join(', ')
  }
  if (node.children) {
    for (const child of node.children)
      rewriteFontFamilies(child, familySubsetNames)
  }
}

async function createImage(event: OgImageRenderEventContext, format: 'png' | 'jpeg' | 'webp') {
  const { options } = event

  const fontFamilyOverride = (options.props as Record<string, any>)?.fontFamily
  const defaultFont = (resolvedFonts as FontConfig[])[0]?.family
  const nodes = await createTakumiNodes(event)
  const codepoints = extractCodepointsFromTakumiNodes(nodes)
  const fonts = await loadAllFonts(event.e, { supportsWoff2: true, preferStatic: true, component: options.component, fontFamilyOverride: fontFamilyOverride || defaultFont, codepoints })

  await event._nitro.hooks.callHook('nuxt-og-image:takumi:nodes' as any, nodes, event)
  sanitizeTakumiStyles(nodes)

  const state = await useTakumiState(event)
  await loadFontsIntoRenderer(state, fonts)

  nodes.style = nodes.style || {}
  if (fontFamilyOverride && state.familySubsetNames.has(fontFamilyOverride)) {
    nodes.style.fontFamily = fontFamilyOverride
  }

  rewriteFontFamilies(nodes, state.familySubsetNames)

  const extractResourceUrls = await useExtractResourceUrls()
  const resourceUrls = await extractResourceUrls(nodes)

  const origin = getNitroOrigin(event.e)
  const baseURL = event.runtimeConfig.app.baseURL

  const fetchedResources = await Promise.all(resourceUrls.map(async (src) => {
    const urlsToTry = [src]
    if (src.startsWith('/')) {
      urlsToTry.push(withBase(src, origin))
      if (baseURL && baseURL !== '/' && !src.startsWith(baseURL)) {
        urlsToTry.push(withBase(withBase(src, baseURL), origin))
      }
    }

    const enteries = []

    for (const url of urlsToTry) {
      const data = await $fetch(url, { responseType: 'arrayBuffer' }).catch(() => null)
      if (data) {
        enteries.push({ src, data: new Uint8Array(data as ArrayBuffer) })
        break
      }
    }

    return enteries
  }))

  const dpr = options.takumi?.devicePixelRatio ?? 2
  const renderOptions = defu(options.takumi, {
    width: Number(options.width) * dpr,
    height: Number(options.height) * dpr,
    format,
    fetchedResources,
    devicePixelRatio: dpr,
  })

  return await state.renderer.render(nodes, renderOptions)
}

const TakumiRenderer: Renderer = {
  name: 'takumi',
  supportedFormats: ['png', 'jpeg', 'jpg', 'json'],

  async createImage(e) {
    switch (e.extension) {
      case 'png':
        return createImage(e, 'png')
      case 'jpeg':
      case 'jpg':
        return createImage(e, 'jpeg')
    }
  },

  async debug(e) {
    const [vnodes, fonts] = await Promise.all([
      createTakumiNodes(e),
      loadAllFonts(e.e, { supportsWoff2: true, preferStatic: true, component: e.options.component }),
    ])
    return {
      vnodes,
      fonts: fonts.map(({ data: _, ...f }) => ({
        ...f,
        size: _.byteLength,
      })),
    }
  },
}

export default TakumiRenderer
