import type { CssInput, Renderer as TakumiNativeRenderer } from '@takumi-rs/core'
import type { OgImageRenderEventContext, Renderer } from '../../../types'
import { withBase } from 'ufo'
import { fetchLocalAsset } from '../../util/fetchLocalAsset'
import { getFetchTimeout } from '../../util/fetchTimeout'
import { fetchWithRedirectValidation, isBlockedUrl } from '../../util/ssrf'
import { withTimeout } from '../../util/withTimeout'
import { TAKUMI_FORMATS } from '../font-source'
import { getDefaultFontFamily, loadFontsForRenderer, parseUnicodeRange, selectLazyFonts } from '../fonts'
import { getTakumi } from './instances'
import { createTakumiNodes } from './nodes'
import { createMp4Encoder, resolveVideoOptions, videoFrameTimes } from './video'

async function getTakumiRenderer(event: OgImageRenderEventContext): Promise<TakumiNativeRenderer> {
  const nitro = event._nitro as any
  if (!nitro._takumiRenderer) {
    const Renderer = await getTakumi()
    nitro._takumiRenderer = new Renderer()
  }
  return nitro._takumiRenderer
}

interface FontEntry { family: string, src?: string, data?: () => Promise<Uint8Array>, weight?: number, style?: string, cacheKey?: string, weightRange?: [number, number], unicodeRange?: string }

interface DedupedFontLoad {
  binaryKey: string
  family: string
  style?: string
  data: () => Promise<Uint8Array>
  unicodeRange?: string
  /** When undefined, binary is shared across multiple weights (variable font) — let takumi read the wght axis. */
  weight: number | undefined
}

/**
 * Collapse font entries that share a binary (same family, style, src) into a single load.
 * @nuxt/fonts produces per-weight entries all pointing to the same variable WOFF2 URL;
 * loading the same binary under multiple weight labels prevents takumi from varying the
 * wght axis. For variable fonts we pass no weight so takumi auto-detects the axis from
 * the font metadata.
 *
 * A binary is treated as variable if EITHER multiple weight tags share it OR any entry
 * carries a `weightRange` (parsed from CSS `font-weight: <min> <max>`). The latter matters
 * in dev when the build-time per-weight expansion may not have run yet — we'd otherwise
 * pass an explicit weight to takumi for a variable file and it would mis-map the axis.
 *
 * Mirrored in test/unit/takumi-font-dedupe.test.ts — keep implementations in sync.
 */
function dedupeFontsByBinary(fonts: FontEntry[]): DedupedFontLoad[] {
  const byBinary = new Map<string, { family: string, style?: string, data: () => Promise<Uint8Array>, unicodeRange?: string, weights: Set<number | undefined>, hasRange: boolean }>()
  for (const font of fonts) {
    if (!font.data)
      continue
    const binaryKey = `${font.family}|${font.style || 'normal'}|${font.src || ''}`
    const existing = byBinary.get(binaryKey)
    if (existing) {
      existing.weights.add(font.weight)
      if (font.weightRange)
        existing.hasRange = true
    }
    else {
      byBinary.set(binaryKey, {
        family: font.family,
        style: font.style,
        data: font.data,
        unicodeRange: font.unicodeRange,
        weights: new Set([font.weight]),
        hasRange: !!font.weightRange,
      })
    }
  }
  const result: DedupedFontLoad[] = []
  for (const [binaryKey, entry] of byBinary) {
    const isVariable = entry.weights.size > 1 || entry.hasRange
    result.push({
      binaryKey,
      family: entry.family,
      style: entry.style,
      data: entry.data,
      unicodeRange: entry.unicodeRange,
      weight: isVariable ? undefined : [...entry.weights][0],
    })
  }
  return result
}

const RE_HTTP_URL = /^https?:\/\//i

const unicodeRanges = new Map<string, [number, number][] | null>()

function parseUnicodeRangeOnce(range: string) {
  if (!unicodeRanges.has(range)) {
    unicodeRanges.set(range, parseUnicodeRange(range))
  }
  return unicodeRanges.get(range)
}

function createFontLoader(entry: DedupedFontLoad, failedKeys: Set<string>) {
  const unicodeRange = entry.unicodeRange ? parseUnicodeRangeOnce(entry.unicodeRange) : null
  return {
    key: entry.binaryKey,
    name: entry.family,
    data: async () => {
      try {
        return await entry.data()
      }
      catch (err) {
        failedKeys.add(entry.binaryKey)
        throw err
      }
    },
    ...(entry.weight !== undefined ? { weight: entry.weight } : {}),
    ...(entry.style ? { style: entry.style as 'normal' | 'italic' | 'oblique' } : {}),
    ...(unicodeRange ? { unicodeRange } : {}),
  }
}

function normalizeImageSources(images: Array<{ src: string, data: ArrayBuffer | Uint8Array }> | undefined): Array<{ src: string, data: Uint8Array }> {
  return (images || []).map(image => ({
    src: image.src,
    data: image.data instanceof Uint8Array ? image.data : new Uint8Array(image.data),
  }))
}

interface TakumiSceneOptions {
  /** libx264 with yuv420p needs even dimensions. */
  evenDimensions: boolean
}

/**
 * Build the template's node tree once and return a function that prepares it at a point on its animation timeline.
 * A still image prepares once; a video prepares once per frame, because Takumi reads `timeMs` at prepare time.
 */
async function createTakumiScene(event: OgImageRenderEventContext, { evenDimensions }: TakumiSceneOptions) {
  const { options, timings } = event

  const { fontFamilyOverride, defaultFont } = getDefaultFontFamily(options)
  const nodes = await createTakumiNodes(event)
  const fontEntries = dedupeFontsByBinary(selectLazyFonts(event.e, { supportedFormats: TAKUMI_FORMATS, component: options.component, fontFamilyOverride: fontFamilyOverride || defaultFont }))

  const renderTimeout = event.runtimeConfig.security?.renderTimeout ?? 15_000
  await withTimeout(
    event._nitro.hooks.callHook('nuxt-og-image:takumi:nodes' as any, nodes, event),
    renderTimeout,
    'nuxt-og-image:takumi:nodes hook',
  )

  const renderer = await timings.measure('takumi-init', () => getTakumiRenderer(event))

  const loadedFamilies = new Set(fontEntries.map(entry => entry.family))
  if (fontFamilyOverride && loadedFamilies.has(fontFamilyOverride)) {
    nodes.style = { ...nodes.style, fontFamily: fontFamilyOverride }
  }

  // Default to 1x DPR for consistent output with satori (1200x600).
  // Users can set `takumi.devicePixelRatio: 2` in defineOgImage options for higher resolution.
  const maxDpr = event.runtimeConfig.security?.maxDpr || 2
  const maxDim = event.runtimeConfig.security?.maxDimension || 2048
  const dpr = Math.min(Math.max(1, options.takumi?.devicePixelRatio ?? 1), maxDpr)
  const dimension = (size: unknown) => {
    const pixels = Math.floor(Math.min(Number(size) * dpr, maxDim))
    return evenDimensions ? pixels - (pixels % 2) : pixels
  }
  const width = dimension(options.width)
  const height = dimension(options.height)
  const fetchTimeout = getFetchTimeout(event.runtimeConfig)

  const failedFontKeys = new Set<string>()
  let fontLoaders = fontEntries.map(entry => createFontLoader(entry, failedFontKeys))
  // Video frames prepare the same tree many times. The cache fetches each image once.
  const fetchCache = new Map<string, Promise<ArrayBuffer>>()
  const signal = AbortSignal.timeout(renderTimeout)
  const prepareWith = (loaders: typeof fontLoaders, timeMs: number | undefined) => renderer.prepare(nodes, {
    width,
    height,
    devicePixelRatio: dpr,
    fonts: loaders,
    fontFamilies: [...loadedFamilies],
    // The rules come from the image URL. Takumi parses them and rejects an invalid rule.
    css: options.takumi?.css as CssInput[] | undefined,
    // Takumi accepts whole milliseconds only.
    timeMs: timeMs === undefined ? undefined : Math.round(Number(timeMs)) || 0,
    images: {
      sources: normalizeImageSources(options.takumi?.images),
      fetch: src => fetchImage(event, src, fetchTimeout),
      // Defense-in-depth: any URL surviving the imageSrc transformer is re-validated here.
      allowUrl: src => src.startsWith('/') || (import.meta.dev ? RE_HTTP_URL.test(src) : !isBlockedUrl(src)),
      timeout: fetchTimeout,
      throwOnError: false,
      fetchCache,
    },
    signal,
  })

  return {
    renderer,
    width,
    height,
    signal,
    renderTimeout,
    prepare(timeMs: number | undefined) {
      // A font that fails to load rejects prepare(), so render without it instead. Later frames skip it too.
      return prepareWith(fontLoaders, timeMs).catch((err) => {
        if (failedFontKeys.size === 0) {
          throw err
        }
        fontLoaders = fontLoaders.filter(loader => !failedFontKeys.has(loader.key))
        return prepareWith(fontLoaders, timeMs)
      })
    },
    /** Start from a fresh Renderer after a failure, so a trapped WASM instance is not reused. */
    discardRenderer() {
      delete (event._nitro as any)._takumiRenderer
    },
  }
}

async function createImage(event: OgImageRenderEventContext, format: 'png' | 'jpeg' | 'webp') {
  const { options, timings } = event
  const scene = await createTakumiScene(event, { evenDimensions: false })
  return await withTimeout((async () => {
    try {
      const prepared = await timings.measure('takumi-prepare', () => scene.prepare(options.takumi?.timeMs))
      return await timings.measure('render-takumi', () => scene.renderer.render(prepared, { format: options.takumi?.format ?? format, signal: scene.signal }))
    }
    catch (err) {
      scene.discardRenderer()
      throw err
    }
  })(), scene.renderTimeout, 'takumi render')
}

async function createVideo(event: OgImageRenderEventContext) {
  const { options, timings } = event
  const video = resolveVideoOptions(options.video)
  const scene = await createTakumiScene(event, { evenDimensions: true })
  return await withTimeout((async () => {
    const encoder = await createMp4Encoder({
      ffmpeg: globalThis.process?.env.NUXT_OG_IMAGE_FFMPEG || 'ffmpeg',
      width: scene.width,
      height: scene.height,
      fps: video.fps,
      signal: scene.signal,
    })
    try {
      await timings.measure('render-takumi', async () => {
        for (const timeMs of videoFrameTimes(video)) {
          const prepared = await scene.prepare(timeMs)
          await encoder.write(await scene.renderer.render(prepared, { format: 'raw', signal: scene.signal }))
        }
      })
      return await timings.measure('encode-mp4', () => encoder.finish())
    }
    catch (err) {
      await encoder.abort()
      scene.discardRenderer()
      throw err
    }
  })(), scene.renderTimeout, 'takumi video render')
}

async function fetchImage(event: OgImageRenderEventContext, src: string, fetchTimeout: number): Promise<Response> {
  // Marker header lets downstream middleware short-circuit expensive work
  // on subrequests we make during OG image rendering (e.g. on CF Workers
  // where a logo/asset path may route back through the same worker).
  const headers = { 'x-nuxt-og-image': '1' }
  let data: ArrayBuffer | undefined | null
  if (src.startsWith('/')) {
    // withBase is a no-op if src already starts with baseURL
    data = await fetchLocalAsset(event.e, withBase(src, event.runtimeConfig.app.baseURL), {
      fetchTimeout,
      headers,
      includeExternalFallback: true,
    })
  }
  else if (import.meta.dev) {
    data = await $fetch<ArrayBuffer>(src, {
      responseType: 'arrayBuffer',
      signal: AbortSignal.timeout(fetchTimeout),
      timeout: fetchTimeout,
      headers,
    })
  }
  else {
    // Redirects are followed manually so 30x → internal-IP cannot complete the SSRF.
    data = await fetchWithRedirectValidation(src, { timeout: fetchTimeout, headers })
  }
  if (!data) {
    throw new Error(`Failed to fetch image ${src}`)
  }
  return new Response(data)
}

const TakumiRenderer: Renderer = {
  name: 'takumi',
  supportedFormats: ['png', 'jpeg', 'jpg', 'webp', 'json', 'mp4'],

  async createImage(e) {
    switch (e.extension) {
      case 'png':
        return createImage(e, 'png')
      case 'jpeg':
      case 'jpg':
        return createImage(e, 'jpeg')
      case 'webp':
        return createImage(e, 'webp')
      case 'mp4':
        return createVideo(e)
    }
  },

  async debug(e) {
    const [vnodes, fonts] = await Promise.all([
      createTakumiNodes(e),
      loadFontsForRenderer(e, { supportedFormats: TAKUMI_FORMATS, component: e.options.component }),
    ])
    return {
      vnodes,
      fonts: fonts.map(({ data, ...f }) => ({
        ...f,
        size: data.byteLength,
      })),
    }
  },
}

export default TakumiRenderer
