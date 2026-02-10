import type { OgImageRenderEventContext, Renderer } from '../../../types'
import { useNitroOrigin } from '#site-config/server/composables/useNitroOrigin'
import { defu } from 'defu'
import { withBase } from 'ufo'
import { loadAllFonts } from '../fonts'
import { useExtractResourceUrls, useTakumi } from './instances'
import { createTakumiNodes } from './nodes'

function detectImageExt(data: Uint8Array, src: string): string {
  // Magic bytes
  if (data[0] === 0x89 && data[1] === 0x50)
    return 'png'
  if (data[0] === 0xFF && data[1] === 0xD8)
    return 'jpg'
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46)
    return 'gif'
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46)
    return 'webp'
  // SVG detection
  const head = new TextDecoder().decode(data.subarray(0, 100))
  if (head.includes('<svg') || head.includes('<?xml'))
    return 'svg'
  // URL hints
  if (src.startsWith('data:image/svg+xml') || src.includes('.svg'))
    return 'svg'
  if (src.startsWith('data:image/png') || src.includes('.png'))
    return 'png'
  if (src.startsWith('data:image/jpeg') || src.includes('.jpg') || src.includes('.jpeg'))
    return 'jpg'
  if (src.startsWith('data:image/webp') || src.includes('.webp'))
    return 'webp'
  return 'png'
}

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
      await state.renderer.loadFont({
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

function linearGradientToSvg(gradient: string, backgroundColor?: string): string | null {
  const match = gradient.match(/linear-gradient\((.*)\)/)
  if (!match)
    return null

  const parts = match[1]!.split(/,(?![^(]*\))/).map(p => p.trim())
  let x1 = '0%'
  let y1 = '0%'
  let x2 = '0%'
  let y2 = '100%'
  let stopsStartIdx = 0

  if (parts[0]!.includes('deg')) {
    const angle = Number.parseInt(parts[0]!) || 180
    const rad = (angle - 90) * (Math.PI / 180)
    x1 = `${50 - Math.cos(rad) * 50}%`
    y1 = `${50 - Math.sin(rad) * 50}%`
    x2 = `${50 + Math.cos(rad) * 50}%`
    y2 = `${50 + Math.sin(rad) * 50}%`
    stopsStartIdx = 1
  }
  else if (parts[0]!.includes('to ')) {
    if (parts[0]!.includes('right')) {
      x1 = '0%'
      x2 = '100%'
      y1 = '0%'
      y2 = '0%'
    }
    else if (parts[0]!.includes('bottom')) {
      x1 = '0%'
      x2 = '0%'
      y1 = '0%'
      y2 = '100%'
    }
    stopsStartIdx = 1
  }

  const stops = parts.slice(stopsStartIdx).map((stop, i, arr) => {
    const stopMatch = stop.match(/^([\s\S]*?)(\s+\d+%)?$/)
    let color = stopMatch?.[1] || stop
    const offset = stopMatch?.[2]?.trim() || `${Math.round((i / (arr.length - 1)) * 100)}%`

    let opacity = '1'
    const rgbaMatch = color.match(/rgba?\(([\s\S]*)\)/)
    if (rgbaMatch) {
      const cParts = rgbaMatch[1]!.split(',').map(p => p.trim())
      if (cParts.length === 4) {
        color = `rgb(${cParts[0]},${cParts[1]},${cParts[2]})`
        opacity = cParts[3]!
      }
    }
    return `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}" />`
  }).join('')

  const bgRect = backgroundColor ? `<rect width="100" height="100" fill="${backgroundColor}" />` : ''
  return `<svg width="2000" height="2000" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient></defs>${bgRect}<rect width="100" height="100" fill="url(#g)" /></svg>`
}

async function createImage(event: OgImageRenderEventContext, format: 'png' | 'jpeg' | 'webp') {
  const { options } = event

  const fontFamilyOverride = (options.props as Record<string, any>)?.fontFamily
  const [nodes, fonts] = await Promise.all([
    await createTakumiNodes(event),
    loadAllFonts(event.e, { supportsWoff2: true, component: options.component, fontFamilyOverride }),
  ])

  await event._nitro.hooks.callHook('nuxt-og-image:takumi:nodes' as any, nodes, event)

  const state = await useTakumiState(event)
  await loadFontsIntoRenderer(state, fonts)

  nodes.style = nodes.style || {}
  if (fontFamilyOverride && state.familySubsetNames.has(fontFamilyOverride)) {
    nodes.style.fontFamily = fontFamilyOverride
  }
  else if (!nodes.style.fontFamily) {
    const allSubsetNames = [...state.familySubsetNames.values()].flat()
    if (allSubsetNames.length)
      nodes.style.fontFamily = allSubsetNames.join(', ')
  }

  rewriteFontFamilies(nodes, state.familySubsetNames)

  const extractResourceUrls = await useExtractResourceUrls()
  const resourceUrls = extractResourceUrls(nodes)
  const { dataUris, bgUrls } = extractInlineResources(nodes)

  const gradients: { node: any, value: string }[] = []
  const walkG = (n: any) => {
    if (n.style?.backgroundImage?.includes('linear-gradient'))
      gradients.push({ node: n, value: n.style.backgroundImage })
    if (n.children) {
      for (const child of n.children)
        walkG(child)
    }
  }
  walkG(nodes)

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
        resourceMap.set(src, new Uint8Array(data))
        break
      }
    }
  }))

  dataUris.forEach(uri => resourceMap.set(uri.src, uri.data))

  const fetchedResources: { src: string, data: Uint8Array }[] = []
  const resourceRewriteMap = new Map<string, string>()

  let resourceIdx = 0
  for (const [originalSrc, data] of resourceMap.entries()) {
    const ext = detectImageExt(data, originalSrc)
    const virtualUrl = `virtual:asset-${resourceIdx++}.${ext}`
    fetchedResources.push({ src: virtualUrl, data })
    resourceRewriteMap.set(originalSrc, virtualUrl)
    if (originalSrc.includes('?'))
      resourceRewriteMap.set(originalSrc.split('?')[0]!, virtualUrl)
  }

  for (const gradient of gradients) {
    const svg = linearGradientToSvg(gradient.value, gradient.node.style?.backgroundColor)
    if (svg) {
      const data = new Uint8Array(Buffer.from(svg))
      const virtualUrl = `virtual:gradient-${fetchedResources.length}.svg`
      fetchedResources.push({ src: virtualUrl, data })
      gradient.node.style.backgroundImage = `url(${virtualUrl})`
      if (!gradient.node.style.backgroundSize)
        gradient.node.style.backgroundSize = 'cover'
    }
  }

  rewriteResourceUrls(nodes, resourceRewriteMap)

  const renderOptions = defu(options.takumi, {
    width: Number(options.width),
    height: Number(options.height),
    format,
    fetchedResources,
  })

  return state.renderer.render(nodes, renderOptions)
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
    const vnodes = await createTakumiNodes(e)
    return { vnodes }
  },
}

export default TakumiRenderer
