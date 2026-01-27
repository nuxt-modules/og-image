import type { OgImageRenderEventContext, Renderer } from '../../../types'
import { defu } from 'defu'
import { loadAllFonts } from '../fonts'
import { useTakumi } from './instances'
import { createTakumiNodes } from './nodes'

interface TakumiState {
  renderer: any
  loadedFontKeys: Set<string>
  // Google Fonts serves variable fonts as multiple WOFF2 subsets (one per unicode-range).
  // When loaded with the same name, the renderer only uses the first match and won't
  // fall through to other subsets for missing glyphs. Using unique names per subset
  // with a comma-separated fontFamily enables proper cross-subset glyph fallback.
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

async function loadFontsIntoRenderer(state: TakumiState, fonts: Array<{ name: string, data?: BufferSource, weight?: number, style?: string, cacheKey?: string }>) {
  for (const font of fonts) {
    if (!font.data)
      continue
    const uniqueKey = font.cacheKey || `${font.name}-${font.weight}-${font.style}`
    if (state.loadedFontKeys.has(uniqueKey))
      continue

    const fontData = font.data instanceof ArrayBuffer
      ? new Uint8Array(font.data)
      : Uint8Array.from(font.data as Uint8Array)

    const subsetName = `${font.name}__${state.subsetCounter++}`
    try {
      state.renderer.loadFont({
        name: subsetName,
        data: fontData,
        weight: font.weight,
        style: font.style as 'normal' | 'italic' | 'oblique',
      })
      if (!state.familySubsetNames.has(font.name))
        state.familySubsetNames.set(font.name, [])
      state.familySubsetNames.get(font.name)!.push(subsetName)
    }
    catch {}
    state.loadedFontKeys.add(uniqueKey)
  }
}

function rewriteFontFamilies(node: any, familySubsetNames: Map<string, string[]>) {
  if (node.style?.fontFamily) {
    const families = node.style.fontFamily.split(',').map((f: string) => f.trim().replace(/['"]/g, ''))
    const expanded = families.flatMap((f: string) => familySubsetNames.get(f) || [f])
    node.style.fontFamily = expanded.join(', ')
  }
  if (node.children) {
    for (const child of node.children)
      rewriteFontFamilies(child, familySubsetNames)
  }
}

async function createImage(event: OgImageRenderEventContext, format: 'png' | 'jpeg' | 'webp') {
  const { options } = event

  const [nodes, fonts] = await Promise.all([
    createTakumiNodes(event),
    loadAllFonts(event.e, { supportsWoff2: true }),
  ])

  await event._nitro.hooks.callHook('nuxt-og-image:takumi:nodes' as any, nodes, event)

  const state = await useTakumiState(event)
  await loadFontsIntoRenderer(state, fonts)

  // Set default fontFamily on root node using all loaded subset names
  nodes.style = nodes.style || {}
  if (!nodes.style.fontFamily) {
    const allSubsetNames = [...state.familySubsetNames.values()].flat()
    if (allSubsetNames.length)
      nodes.style.fontFamily = allSubsetNames.join(', ')
  }

  rewriteFontFamilies(nodes, state.familySubsetNames)

  const renderOptions = defu(options.takumi, {
    width: options.width!,
    height: options.height!,
    format,
  })

  return state.renderer.render(nodes, renderOptions)
}

const TakumiRenderer: Renderer = {
  name: 'takumi',
  supportedFormats: ['png', 'jpeg', 'jpg'],

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
    const nodes = await createTakumiNodes(e)
    return { nodes }
  },
}

export default TakumiRenderer
