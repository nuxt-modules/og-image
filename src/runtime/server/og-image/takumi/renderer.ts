import type { Node } from '@takumi-rs/core'
import type { OgImageRenderEventContext, Renderer } from '../../../types'
import { defu } from 'defu'
import { withBase } from 'ufo'
import { logger } from '../../../logger'
import { fetchLocalAsset } from '../../util/fetchLocalAsset'
import { getFetchTimeout } from '../../util/fetchTimeout'
import { fetchWithRedirectValidation, isBlockedUrl } from '../../util/ssrf'
import { withTimeout } from '../../util/withTimeout'
import { buildSubsetFamilyChain, extractCodepoints, getDefaultFontFamily, loadFontsForRenderer, resolveSubsetChain } from '../fonts'
import { getExtractResourceUrls, getTakumi } from './instances'
import { createTakumiNodes } from './nodes'

const RE_QUOTES = /['"]/g

interface TakumiState {
  renderer: any
  loadedFontKeys: Set<string>
  loadedFamilies: Set<string>
  // Serializes WASM-touching work on the shared Renderer. The renderer is
  // reused across requests in the same isolate (nitroApp is module-scope on
  // CF Workers etc.) and concurrent loadFont/render calls share linear memory,
  // which can corrupt state and burn CPU until the wall-clock fires.
  lock: Promise<unknown>
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
    lock: Promise.resolve(),
  } satisfies TakumiState
  return nitro._takumiState
}

function withTakumiLock<T>(
  state: TakumiState,
  timeoutMs: number,
  fn: () => Promise<T>,
  onLockTimeout?: () => void,
): Promise<T> {
  const guarded = async (): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`takumi render timed out after ${timeoutMs}ms (lock-held)`)),
            timeoutMs,
          )
        }),
      ])
    }
    catch (err) {
      // The hung fn() is still running and holds linear memory. Recreate the
      // renderer so the next caller starts on a fresh isolate-local instance;
      // the old renderer is unreferenced and GC'd once fn() finally settles.
      // Without this reset the lock chain grows unbounded under hangs and
      // burns CPU on every subsequent waiter.
      try {
        const Renderer = await getTakumi()
        state.renderer = new Renderer()
        state.loadedFontKeys.clear()
        state.loadedFamilies.clear()
      }
      catch (resetErr) {
        logger.warn(`failed to reset takumi renderer after lock timeout: ${(resetErr as Error)?.message || resetErr}`)
      }
      throw err
    }
    finally {
      clearTimeout(timer)
    }
  }
  // Schedule the work once; future callers chain off this same `work`.
  const work = state.lock.then(guarded, guarded)
  state.lock = work.catch(() => undefined)
  // Lock-acquire timeout: if `work` (or the previous holder it queues behind)
  // hangs past timeoutMs, release THIS caller early so the upstream request
  // returns 408 instead of contributing to a snowballing queue. The work
  // itself keeps running on the chain so its own inner timeout can recover.
  let acquireTimer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      acquireTimer = setTimeout(() => {
        onLockTimeout?.()
        reject(new Error(`takumi lock acquire timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    }),
  ]).finally(() => clearTimeout(acquireTimer))
}

interface FontEntry { family: string, src?: string, data?: BufferSource, weight?: number, style?: string, cacheKey?: string }

interface DedupedFontLoad {
  binaryKey: string
  family: string
  style?: string
  data: BufferSource
  /** When undefined, binary is shared across multiple weights (variable font) — let takumi read the wght axis. */
  weight: number | undefined
}

/**
 * Collapse font entries that share a binary (same family, style, src) into a single load.
 * @nuxt/fonts produces per-weight entries all pointing to the same variable WOFF2 URL;
 * loading the same binary under multiple weight labels prevents takumi from varying the
 * wght axis. For variable fonts (multiple weights sharing a binary) we pass no weight so
 * takumi auto-detects the axis from the font metadata.
 *
 * Mirrored in test/unit/takumi-font-dedupe.test.ts — keep implementations in sync.
 */
function dedupeFontsByBinary(fonts: FontEntry[]): DedupedFontLoad[] {
  const byBinary = new Map<string, { family: string, style?: string, data: BufferSource, weights: Set<number | undefined> }>()
  for (const font of fonts) {
    if (!font.data)
      continue
    const binaryKey = `${font.family}|${font.style || 'normal'}|${font.src || ''}`
    const existing = byBinary.get(binaryKey)
    if (existing) {
      existing.weights.add(font.weight)
    }
    else {
      byBinary.set(binaryKey, {
        family: font.family,
        style: font.style,
        data: font.data,
        weights: new Set([font.weight]),
      })
    }
  }
  const result: DedupedFontLoad[] = []
  for (const [binaryKey, entry] of byBinary) {
    const isVariable = entry.weights.size > 1
    result.push({
      binaryKey,
      family: entry.family,
      style: entry.style,
      data: entry.data,
      weight: isVariable ? undefined : [...entry.weights][0],
    })
  }
  return result
}

async function loadFontsIntoRenderer(state: TakumiState, fonts: FontEntry[]) {
  for (const entry of dedupeFontsByBinary(fonts)) {
    if (state.loadedFontKeys.has(entry.binaryKey))
      continue

    const fontData = entry.data instanceof ArrayBuffer
      ? new Uint8Array(entry.data)
      : Uint8Array.from(entry.data as Uint8Array)

    try {
      await state.renderer.loadFont({
        name: entry.family,
        data: fontData,
        ...(entry.weight !== undefined ? { weight: entry.weight } : {}),
        style: entry.style as 'normal' | 'italic' | 'oblique',
      })
      state.loadedFamilies.add(entry.family)
    }
    catch (err) {
      logger.warn(`Failed to load font "${entry.family}" into takumi renderer: ${(err as Error).message}`)
    }
    state.loadedFontKeys.add(entry.binaryKey)
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
  const { options, timings } = event

  const { fontFamilyOverride, defaultFont } = getDefaultFontFamily(options)
  const nodes = await createTakumiNodes(event)
  const codepoints = extractCodepoints(nodes)
  const fonts = await timings.measure('font-load', () => loadFontsForRenderer(event, { supportedFormats: new Set(['ttf', 'woff2'] as const), preferStatic: true, component: options.component, fontFamilyOverride: fontFamilyOverride || defaultFont, codepoints }))

  const hookTimeout = event.runtimeConfig.security?.renderTimeout ?? 15_000
  await withTimeout(
    event._nitro.hooks.callHook('nuxt-og-image:takumi:nodes' as any, nodes, event),
    hookTimeout,
    'nuxt-og-image:takumi:nodes hook',
  )

  const subsetChains = buildSubsetFamilyChain(fonts)

  const state = await timings.measure('takumi-init', () => getTakumiState(event))

  // Resource extraction + fetching can run outside the WASM lock — they don't
  // touch the shared Renderer instance, so concurrent requests can overlap I/O.
  const extractResourceUrls = await timings.measure('takumi-extract-init', () => getExtractResourceUrls())
  const resourceUrls = await extractResourceUrls(nodes)

  const baseURL = event.runtimeConfig.app.baseURL

  const fetchedResources: Array<{ src: string, data: Uint8Array }> = []
  if (resourceUrls.length) {
    const fetchTimeout = getFetchTimeout(event.runtimeConfig)
    // Marker header lets downstream middleware short-circuit expensive work
    // on subrequests we make during OG image rendering (e.g. on CF Workers
    // where a logo/asset path may route back through the same worker).
    const headers = { 'x-nuxt-og-image': '1' }
    await timings.measure('resource-fetch', () => Promise.all(resourceUrls.map(async (src) => {
      let data: ArrayBuffer | undefined
      if (src.startsWith('/')) {
        // withBase is a no-op if src already starts with baseURL
        const path = withBase(src, baseURL)
        data = await fetchLocalAsset(event.e, path, {
          fetchTimeout,
          headers,
          includeExternalFallback: true,
        })
      }
      else if (import.meta.dev) {
        data = await $fetch(src, {
          responseType: 'arrayBuffer',
          signal: AbortSignal.timeout(fetchTimeout),
          timeout: fetchTimeout,
          headers,
        }).catch(() => undefined) as ArrayBuffer | undefined
      }
      else if (!isBlockedUrl(src)) {
        // Defense-in-depth: any URL surviving the imageSrc transformer is
        // re-validated here, with redirects followed manually so 30x →
        // internal-IP cannot complete the SSRF.
        data = (await fetchWithRedirectValidation(src, {
          timeout: fetchTimeout,
          headers,
        })) ?? undefined
      }
      if (data)
        fetchedResources.push({ src, data: new Uint8Array(data) })
    })))
  }

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

  // WASM critical section: loadFont and render mutate the shared Renderer's
  // linear memory. Serializing per isolate avoids cross-request corruption.
  // lock-wait captures queue time behind prior renders; render-takumi only
  // covers post-acquire work so the two are additive and attributable.
  const lockTimeout = event.runtimeConfig.security?.renderTimeout ?? 15_000
  const endLockWait = timings.start('lock-wait')
  return await withTakumiLock(state, lockTimeout, () => {
    endLockWait()
    return timings.measure('render-takumi', async () => {
      await loadFontsIntoRenderer(state, fonts)

      const rootStyle = nodes.style ?? {}
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

      return state.renderer.render(nodes, renderOptions)
    })
  }, endLockWait)
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
      loadFontsForRenderer(e, { supportedFormats: new Set(['ttf', 'woff2'] as const), preferStatic: true, component: e.options.component }),
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
