import type { Node } from '@takumi-rs/core'
import type { OgImageRenderEventContext, Renderer } from '../../../types'
import { getNitroOrigin } from '#site-config/server/composables'
import { defu } from 'defu'
import { withBase } from 'ufo'
import { logger } from '../../../logger'
import { buildSubsetFamilyChain, extractCodepoints, getDefaultFontFamily, loadFontsForRenderer, resolveSubsetChain } from '../fonts'
import { getExtractResourceUrls, getTakumi } from './instances'
import { createTakumiNodes } from './nodes'

const RE_QUOTES = /['"]/g

interface TakumiState {
  renderer: any
  loadedFontKeys: Set<string>
  loadedFamilies: Set<string>
}

async function getTakumiState(event: OgImageRenderEventContext): Promise<TakumiState> {
  const nitro = event._nitro as any
  if (nitro._takumiState)
    return nitro._takumiState
  const Renderer = await getTakumi()
  nitro._takumiState = {
    renderer: new Renderer(),
    loadedFontKeys: new Set(),
    loadedFamilies: new Set(),
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

    try {
      // Use the real family name so takumi can do font-weight matching
      // within the same family. Previously each weight got a unique subset
      // name (e.g. "Inter__0", "Inter__1") which broke weight selection.
      await state.renderer.loadFont({
        name: font.family,
        data: fontData,
        weight: font.weight,
        style: font.style as 'normal' | 'italic' | 'oblique',
      })
      state.loadedFamilies.add(font.family)
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
function lookupFontFamily(family: string, loadedFamilies: Set<string>): string | undefined {
  if (loadedFamilies.has(family))
    return family
  for (const loaded of loadedFamilies) {
    if (loaded.toLowerCase() === family.toLowerCase())
      return loaded
  }
}

function rewriteFontFamilies(node: Node, loadedFamilies: Set<string>, subsetChains: Map<string, string[]>) {
  if (node.style?.fontFamily) {
    const families = (node.style.fontFamily as string).split(',').map((f: string) => f.trim().replace(RE_QUOTES, ''))
    const resolved: string[] = []
    const seen = new Set<string>()
    const addUnique = (name: string) => {
      if (!seen.has(name.toLowerCase())) {
        resolved.push(name)
        seen.add(name.toLowerCase())
      }
    }
    for (const f of families) {
      // Check if this is an original family name that was split into subsets
      const chain = resolveSubsetChain(f, subsetChains)
      if (chain) {
        chain.forEach(addUnique)
        continue
      }
      // Resolve case-insensitive match against loaded families
      addUnique(lookupFontFamily(f, loadedFamilies) || f)
    }
    // Append remaining loaded families as fallback for missing glyphs
    for (const family of loadedFamilies)
      addUnique(family)
    node.style.fontFamily = resolved.map((f: string) => `"${f}"`).join(', ')
  }
  if ('children' in node && node.children) {
    for (const child of node.children)
      rewriteFontFamilies(child, loadedFamilies, subsetChains)
  }
}

async function createImage(event: OgImageRenderEventContext, format: 'png' | 'jpeg' | 'webp') {
  const { options } = event

  const { fontFamilyOverride, defaultFont } = getDefaultFontFamily(options)
  const nodes = await createTakumiNodes(event)
  const codepoints = extractCodepoints(nodes)
  const fonts = await loadFontsForRenderer(event, { supportedFormats: new Set(['ttf', 'woff2'] as const), component: options.component, fontFamilyOverride: fontFamilyOverride || defaultFont, codepoints })

  await event._nitro.hooks.callHook('nuxt-og-image:takumi:nodes' as any, nodes, event)

  const subsetChains = buildSubsetFamilyChain(fonts)

  const state = await getTakumiState(event)
  await loadFontsIntoRenderer(state, fonts)

  const rootStyle = nodes.style ?? {}
  // If fontFamilyOverride was renamed into subsets, use the chain instead
  if (fontFamilyOverride) {
    const chain = subsetChains.get(fontFamilyOverride)
    if (chain) {
      rootStyle.fontFamily = chain.map(f => `"${f}"`).join(', ')
    }
    else if (state.loadedFamilies.has(fontFamilyOverride)) {
      rootStyle.fontFamily = fontFamilyOverride
    }
  }
  nodes.style = rootStyle

  rewriteFontFamilies(nodes, state.loadedFamilies, subsetChains)

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
  const maxDpr = event.runtimeConfig.security?.maxDpr || 2
  const maxDim = event.runtimeConfig.security?.maxDimension || 2048
  const dpr = Math.min(Math.max(1, options.takumi?.devicePixelRatio ?? 1), maxDpr)
  const renderOptions = defu(options.takumi, {
    width: Math.min(Number(options.width) * dpr, maxDim),
    height: Math.min(Number(options.height) * dpr, maxDim),
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
      loadFontsForRenderer(e, { supportedFormats: new Set(['ttf', 'woff2'] as const), component: e.options.component }),
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
