import type { Node } from '@takumi-rs/core'
import type { OgImageRenderEventContext, Renderer } from '../../../types'
import { getNitroOrigin } from '#site-config/server/composables'
import { defu } from 'defu'
import { withBase } from 'ufo'
import { logger } from '../../../logger'
import { extractCodepoints, getDefaultFontFamily, loadFontsForRenderer } from '../fonts'
import { getExtractResourceUrls, getTakumi } from './instances'
import { createTakumiNodes } from './nodes'

const RE_QUOTES = /['"]/g

interface TakumiState {
  renderer: any
  loadedFontKeys: Set<string>
  familySubsetNames: Map<string, string[]>
  subsetCounter: number
}

async function getTakumiState(event: OgImageRenderEventContext): Promise<TakumiState> {
  const nitro = event._nitro as any
  if (nitro._takumiState)
    return nitro._takumiState
  const Renderer = await getTakumi()
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
      // Store lowercase alias for case-insensitive font-family matching
      const lowerFamily = font.family.toLowerCase()
      if (lowerFamily !== font.family) {
        if (!state.familySubsetNames.has(lowerFamily))
          state.familySubsetNames.set(lowerFamily, [])
        state.familySubsetNames.get(lowerFamily)!.push(subsetName)
      }
    }
    catch (err) {
      logger.warn(`Failed to load font "${font.family}" (weight: ${font.weight}) into takumi renderer: ${(err as Error).message}`)
    }
    state.loadedFontKeys.add(uniqueKey)
  }
}

/**
 * Case-insensitive font family lookup. Tries exact match first, then lowercase.
 * This handles mismatched casing between template styles ('Biz UDPGothic')
 * and @nuxt/fonts canonical names ('BIZ UDPGothic').
 */
function lookupFontSubsets(family: string, familySubsetNames: Map<string, string[]>): string[] | undefined {
  return familySubsetNames.get(family) || familySubsetNames.get(family.toLowerCase())
}

function rewriteFontFamilies(node: Node, familySubsetNames: Map<string, string[]>) {
  if (node.style?.fontFamily) {
    const families = (node.style.fontFamily as string).split(',').map((f: string) => f.trim().replace(RE_QUOTES, ''))
    const expanded = families.flatMap((f: string) => lookupFontSubsets(f, familySubsetNames) || [f])
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
    // Quote each name so multi-word subset names like "Nunito Sans__0" are parsed correctly
    node.style.fontFamily = expanded.map((f: string) => `"${f}"`).join(', ')
  }
  if ('children' in node && node.children) {
    for (const child of node.children)
      rewriteFontFamilies(child, familySubsetNames)
  }
}

async function createImage(event: OgImageRenderEventContext, format: 'png' | 'jpeg' | 'webp') {
  const { options } = event

  const { fontFamilyOverride, defaultFont } = getDefaultFontFamily(options)
  const nodes = await createTakumiNodes(event)
  const codepoints = extractCodepoints(nodes)
  const fonts = await loadFontsForRenderer(event, { supportsWoff2: true, preferStatic: true, component: options.component, fontFamilyOverride: fontFamilyOverride || defaultFont, codepoints })

  await event._nitro.hooks.callHook('nuxt-og-image:takumi:nodes' as any, nodes, event)

  const state = await getTakumiState(event)
  await loadFontsIntoRenderer(state, fonts)

  const rootStyle = nodes.style ?? {}
  if (fontFamilyOverride && state.familySubsetNames.has(fontFamilyOverride)) {
    rootStyle.fontFamily = fontFamilyOverride
  }
  nodes.style = rootStyle

  rewriteFontFamilies(nodes, state.familySubsetNames)

  const extractResourceUrls = await getExtractResourceUrls()
  const resourceUrls = await extractResourceUrls(nodes)

  const origin = getNitroOrigin(event.e)
  const baseURL = event.runtimeConfig.app.baseURL

  const fetchedResources: Array<{ src: string, data: Uint8Array }> = []
  await Promise.all(resourceUrls.map(async (src) => {
    const urlsToTry = [src]
    if (src.startsWith('/')) {
      urlsToTry.push(withBase(src, origin))
      if (baseURL && baseURL !== '/' && !src.startsWith(baseURL)) {
        urlsToTry.push(withBase(withBase(src, baseURL), origin))
      }
    }

    for (const url of urlsToTry) {
      const data = await $fetch(url, { responseType: 'arrayBuffer' }).catch(() => null)
      if (data) {
        fetchedResources.push({ src, data: new Uint8Array(data as ArrayBuffer) })
        break
      }
    }
  }))

  // Default to 1x DPR for consistent output with satori (1200x600).
  // Users can set `takumi.devicePixelRatio: 2` in defineOgImage options for higher resolution.
  const dpr = options.takumi?.devicePixelRatio ?? 1
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
  supportedFormats: ['png', 'jpeg', 'jpg', 'webp', 'json'],

  async createImage(e) {
    switch (e.extension) {
      case 'png':
        return createImage(e, 'png')
      case 'jpeg':
      case 'jpg':
        return createImage(e, 'jpeg')
      case 'webp':
        return createImage(e, 'webp')
    }
  },

  async debug(e) {
    const [vnodes, fonts] = await Promise.all([
      createTakumiNodes(e),
      loadFontsForRenderer(e, { supportsWoff2: true, preferStatic: true, component: e.options.component }),
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
