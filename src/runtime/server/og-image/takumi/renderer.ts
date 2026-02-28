import type { FontConfig, OgImageRenderEventContext, Renderer } from '../../../types'
import resolvedFonts from '#og-image/fonts'
import { useNitroOrigin } from '#site-config/server/composables/useNitroOrigin'
import { defu } from 'defu'
import { withBase } from 'ufo'
import { logger } from '../../../logger'
import { extractCodepointsFromTakumiNodes, loadAllFonts } from '../fonts'
import { detectImageExt } from '../utils/image-detector'
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

function extractInlineResources(node: any): { dataUris: { src: string, data: Uint8Array }[], bgUrls: string[] } {
  const dataUris: { src: string, data: Uint8Array }[] = []
  const bgUrls: string[] = []
  const walk = (n: any) => {
    if (n.src?.startsWith('data:')) {
      const commaIdx = n.src.indexOf(',')
      if (commaIdx !== -1) {
        const meta = n.src.slice(0, commaIdx)
        const dataStr = n.src.slice(commaIdx + 1)
        try {
          const isBase64 = meta.includes('base64')
          const data = isBase64
            ? Buffer.from(dataStr, 'base64')
            : Buffer.from(decodeURIComponent(dataStr))
          dataUris.push({ src: n.src, data: new Uint8Array(data) })
        }
        catch {}
      }
    }
    if (n.style?.backgroundImage) {
      let bg = n.style.backgroundImage
      const matches = [...bg.matchAll(/url\(['"]?([^'")\s]+)['"]?\)/g)]
      for (const match of matches) {
        const fullMatch = match[0]
        const src = match[1]
        bg = bg.replace(fullMatch, `url(${src})`)
        if (src.startsWith('data:')) {
          const commaIdx = src.indexOf(',')
          if (commaIdx !== -1) {
            const meta = src.slice(0, commaIdx)
            const dataStr = src.slice(commaIdx + 1)
            try {
              const isBase64 = meta.includes('base64')
              const data = isBase64
                ? Buffer.from(dataStr, 'base64')
                : Buffer.from(decodeURIComponent(dataStr))
              dataUris.push({ src, data: new Uint8Array(data) })
            }
            catch {}
          }
        }
        else {
          bgUrls.push(src)
        }
      }
      n.style.backgroundImage = bg
    }
    if (n.children) {
      for (const child of n.children)
        walk(child)
    }
  }
  walk(node)
  return { dataUris, bgUrls }
}

function rewriteResourceUrls(node: any, map: Map<string, string>) {
  const walk = (n: any) => {
    if (n.src && map.has(n.src)) {
      n.src = map.get(n.src)
    }
    if (n.style?.backgroundImage) {
      let bg = n.style.backgroundImage
      const sortedKeys = [...map.keys()].sort((a, b) => b.length - a.length)
      for (const oldUrl of sortedKeys) {
        const newUrl = map.get(oldUrl)!
        const escapedUrl = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        bg = bg.replace(new RegExp(escapedUrl, 'g'), newUrl)
      }
      n.style.backgroundImage = bg
    }
    if (n.children) {
      for (const child of n.children)
        walk(child)
    }
  }
  walk(node)
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
  const resourceUrls = extractResourceUrls(nodes)
  const { dataUris, bgUrls } = extractInlineResources(nodes)

  const allUrls = new Set([...resourceUrls, ...bgUrls])
  const origin = useNitroOrigin(event.e)
  const baseURL = event.runtimeConfig.app.baseURL

  const resourceMap = new Map<string, Uint8Array>()

  await Promise.all([...allUrls].map(async (src) => {
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
        resourceMap.set(src, new Uint8Array(data as ArrayBuffer))
        break
      }
    }
  }))

  dataUris.forEach(uri => resourceMap.set(uri.src, uri.data))

  const fetchedResources: { src: string, data: Uint8Array }[] = []
  const resourceRewriteMap = new Map<string, string>()

  let resourceIdx = 0
  for (let [originalSrc, data] of resourceMap.entries()) {
    const ext = detectImageExt(data, originalSrc)
    // Strip <text>/<tspan> from SVG resources — takumi WASM hangs on them
    if (ext === 'svg') {
      const svg = Buffer.from(data).toString('utf-8')
      const stripped = svg.replace(/<text[\s\S]*?<\/text>/gi, '')
      if (stripped !== svg)
        data = new Uint8Array(Buffer.from(stripped))
    }
    const virtualUrl = `virtual:asset-${resourceIdx++}.${ext}`
    fetchedResources.push({ src: virtualUrl, data })
    resourceRewriteMap.set(originalSrc, virtualUrl)
    if (originalSrc.includes('?'))
      resourceRewriteMap.set(originalSrc.split('?')[0]!, virtualUrl)
  }

  rewriteResourceUrls(nodes, resourceRewriteMap)

  const dpr = options.takumi?.devicePixelRatio ?? 2
  const renderOptions = defu(options.takumi, {
    width: Number(options.width) * dpr,
    height: Number(options.height) * dpr,
    format,
    fetchedResources,
    devicePixelRatio: dpr,
  })

  const result = await state.renderer.render(nodes, renderOptions)

  // @takumi-rs/wasm path
  if ('asUint8Array' in result) {
    const buffer = result.asUint8Array().slice();

    result.free();

    return buffer;
  }

  return result;
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
