import type { Nuxt } from '@nuxt/schema'
import type { FontFaceData } from 'unifont'
import { hasNuxtModule, useLogger } from '@nuxt/kit'

const logger = useLogger('nuxt-og-image:fonts')

export interface ResolvedNuxtFont {
  family: string
  weight: number
  style: 'normal' | 'italic'
  src: string // original provider URL for fallback
  localPath: string // /_fonts/{filename} - for @nuxt/fonts cache lookup
}

interface FontsModuleOptions {
  families?: Array<{
    name: string
    weights?: Array<string | number>
    styles?: string[]
    provider?: string
  }>
  defaults?: {
    weights?: Array<string | number>
    styles?: string[]
  }
  providers?: Record<string, unknown>
  assets?: { prefix?: string }
}

export interface NuxtFontsIntegrationResult {
  hasNuxtFonts: boolean
  fontsPromise: Promise<ResolvedNuxtFont[]>
}

export function setupNuxtFontsIntegration(nuxt: Nuxt): NuxtFontsIntegrationResult {
  const hasNuxtFonts = hasNuxtModule('@nuxt/fonts', nuxt)

  // deferred resolution - fonts resolved after modules:done
  let resolveFonts: (fonts: ResolvedNuxtFont[]) => void
  const fontsPromise = new Promise<ResolvedNuxtFont[]>((resolve) => {
    resolveFonts = resolve
  })

  // storage for resolved fonts - populated in modules:done, used in nitro:config
  let resolvedFontsData: ResolvedNuxtFont[] = []

  // setup virtual module synchronously - uses getter for lazy evaluation
  nuxt.hook('nitro:config', (nitroConfig) => {
    nitroConfig.virtual ||= {}
    nitroConfig.virtual['#nuxt-og-image/fonts'] = () => `
export const hasNuxtFonts = ${resolvedFontsData.length > 0}
export const resolvedFonts = ${JSON.stringify(resolvedFontsData)}
`
  })

  if (!hasNuxtFonts) {
    resolveFonts!([])
    return { hasNuxtFonts, fontsPromise }
  }

  const fontsOptions = (nuxt.options as unknown as { fonts?: FontsModuleOptions }).fonts || {}

  // resolve fonts after @nuxt/fonts has set up
  nuxt.hook('modules:done', async () => {
    resolvedFontsData = await resolveFontsFromConfig(nuxt, fontsOptions)
    resolveFonts!(resolvedFontsData)

    if (resolvedFontsData.length > 0) {
      logger.info(`Resolved ${resolvedFontsData.length} font variants from @nuxt/fonts`)
    }
  })

  return { hasNuxtFonts, fontsPromise }
}

async function resolveFontsFromConfig(nuxt: Nuxt, fontsOptions: FontsModuleOptions): Promise<ResolvedNuxtFont[]> {
  const families = fontsOptions.families || []
  if (families.length === 0)
    return []

  // dynamic import fontless to create resolver
  const { createResolver, resolveProviders, defaultOptions, normalizeFontData } = await import('fontless')

  // create normalization context matching @nuxt/fonts
  const assetsBaseURL = fontsOptions.assets?.prefix || '/_fonts'
  const renderedFontURLs = new Map<string, string>()
  const context = {
    dev: nuxt.options.dev,
    renderedFontURLs,
    assetsBaseURL,
  }

  const normalizeFn = normalizeFontData.bind(null, context)

  // resolve providers same as @nuxt/fonts
  // merge user providers with default providers from fontless
  const mergedProviders = { ...defaultOptions.providers, ...(fontsOptions.providers || {}) }
  const providers = await resolveProviders(
    mergedProviders as Parameters<typeof resolveProviders>[0],
    { root: nuxt.options.rootDir, alias: nuxt.options.alias },
  )

  // capture resolved fonts
  const resolvedFonts: ResolvedNuxtFont[] = []

  const resolver = await createResolver({
    options: { ...defaultOptions, ...fontsOptions } as Parameters<typeof createResolver>[0]['options'],
    providers,
    normalizeFontData: normalizeFn,
    exposeFont: (details) => {
      // extract font face data
      for (const font of details.fonts) {
        const urls = extractFontUrls(font)
        if (urls) {
          resolvedFonts.push({
            family: details.fontFamily,
            weight: normalizeWeight(font.weight),
            style: normalizeStyle(font.style),
            src: urls.original,
            localPath: urls.local,
          })
        }
      }
    },
  })

  // resolve each configured family
  for (const family of families) {
    const weights = family.weights || fontsOptions.defaults?.weights || [400]
    const styles = family.styles || fontsOptions.defaults?.styles || ['normal']

    await resolver(family.name, {
      name: family.name,
      weights: weights.map(w => typeof w === 'string' ? Number.parseInt(w, 10) : w),
      styles: styles as ('normal' | 'italic')[],
      provider: family.provider,
    }).catch(() => {})
  }

  return resolvedFonts
}

interface FontUrls {
  original: string // provider CDN URL
  local: string // /_fonts/{filename} path
}

function extractFontUrls(font: FontFaceData): FontUrls | null {
  if (!font.src)
    return null

  // prefer woff2 format
  for (const source of font.src) {
    if ('url' in source && source.url) {
      const isWoff2 = source.url.includes('.woff2') || source.format === 'woff2'
      if (isWoff2) {
        const typed = source as { originalURL?: string, url: string }
        // source.url is the /_fonts/ path, originalURL is the provider CDN
        if (typed.originalURL) {
          return { original: typed.originalURL, local: typed.url }
        }
        // if no originalURL, url is the original (e.g., local fonts)
        return { original: typed.url, local: typed.url }
      }
    }
  }

  // fallback to first url
  for (const source of font.src) {
    if ('url' in source && source.url) {
      const typed = source as { originalURL?: string, url: string }
      if (typed.originalURL) {
        return { original: typed.originalURL, local: typed.url }
      }
      return { original: typed.url, local: typed.url }
    }
  }

  return null
}

function normalizeWeight(weight: FontFaceData['weight']): number {
  if (typeof weight === 'number')
    return weight
  if (typeof weight === 'string') {
    const parsed = Number.parseInt(weight, 10)
    if (!Number.isNaN(parsed))
      return parsed
  }
  return 400
}

function normalizeStyle(style: FontFaceData['style']): 'normal' | 'italic' {
  if (style === 'italic' || style === 'oblique')
    return 'italic'
  return 'normal'
}
