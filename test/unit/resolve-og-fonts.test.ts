import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getStaticFontCacheDir, getStaticInterFonts } from '../../src/build/fonts'

// Mock parseFontsFromTemplate to avoid needing real nuxt instance
vi.mock('../../src/build/fonts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/build/fonts')>()
  return {
    ...mod,
    parseFontsFromTemplate: vi.fn().mockResolvedValue([]),
  }
})

const { prepareWoff2Fonts, resolveOgImageFonts } = await import('../../src/build/fontless')
const { parseFontsFromTemplate } = await import('../../src/build/fonts')

const baseFontReqs = { weights: [400, 700], styles: ['normal' as const], families: [] as string[], hasDynamicBindings: false, componentMap: {} }

function createOpts(overrides: Record<string, any> = {}) {
  // Fresh nuxt mock per call to avoid cache leakage
  return {
    nuxt: { options: { buildDir: '/tmp/test', rootDir: '/tmp' } } as any,
    hasNuxtFonts: true,
    hasSatoriRenderer: false,
    fontState: { fallbackMap: new Map<string, string>(), sourceMap: new Map<string, string>() },
    fontRequirements: baseFontReqs,
    tw4FontVars: {},
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn() } as any,
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(parseFontsFromTemplate).mockReset().mockResolvedValue([])
})

describe('resolveOgImageFonts', () => {
  it('returns Inter fallback when no fonts and no @nuxt/fonts', async () => {
    const opts = createOpts({ hasNuxtFonts: false })
    const fonts = await resolveOgImageFonts(opts)
    const inter = getStaticInterFonts()
    expect(fonts).toEqual(inter)
  })

  it('returns parsed fonts for non-satori renderer', async () => {
    const mockFonts = [{ family: 'Inter', src: '/test.woff2', weight: 400, style: 'normal' }]
    vi.mocked(parseFontsFromTemplate).mockResolvedValueOnce(mockFonts)
    const opts = createOpts()
    const fonts = await resolveOgImageFonts(opts)
    expect(fonts).toEqual(mockFonts)
  })

  it('returns Inter fallback for satori with no fonts and no @nuxt/fonts', async () => {
    const opts = createOpts({ hasSatoriRenderer: true, hasNuxtFonts: false })
    const fonts = await resolveOgImageFonts(opts)
    expect(fonts[0].family).toBe('Inter')
  })

  it('logs debug and appends Inter when all fonts are variable (no satoriSrc)', async () => {
    const variableFont = { family: 'Inter', src: '/inter.woff2', weight: 400, style: 'normal' }
    vi.mocked(parseFontsFromTemplate).mockResolvedValueOnce([variableFont])
    const opts = createOpts({ hasSatoriRenderer: true })
    const fonts = await resolveOgImageFonts(opts)
    expect(opts.logger.debug).toHaveBeenCalled()
    expect(fonts.some((f: any) => f.satoriSrc)).toBe(true)
  })

  it('returns fonts with satoriSrc for satori renderer (plus Inter fallback)', async () => {
    const staticFont = { family: 'Inter', src: '/inter.ttf', weight: 400, style: 'normal', satoriSrc: '/inter.ttf' }
    vi.mocked(parseFontsFromTemplate).mockResolvedValueOnce([staticFont])
    const opts = createOpts({ hasSatoriRenderer: true })
    const fonts = await resolveOgImageFonts(opts)
    // First font is the user-provided static font, Inter 700 fallback is appended
    expect(fonts[0]).toEqual(staticFont)
    expect(fonts.some((f: any) => f.family === 'Inter' && f.weight === 700)).toBe(true)
  })

  it('filters by requirements when no dynamic bindings', async () => {
    const fonts400 = { family: 'Inter', src: '/inter-400.ttf', weight: 400, style: 'normal' }
    const fonts300 = { family: 'Inter', src: '/inter-300.ttf', weight: 300, style: 'normal' }
    vi.mocked(parseFontsFromTemplate).mockResolvedValueOnce([fonts400, fonts300])
    const opts = createOpts()
    const result = await resolveOgImageFonts(opts)
    expect(result).toEqual([fonts400])
  })

  it('skips filtering when hasDynamicBindings is true', async () => {
    const fonts400 = { family: 'Inter', src: '/inter-400.ttf', weight: 400, style: 'normal' }
    const fonts300 = { family: 'Inter', src: '/inter-300.ttf', weight: 300, style: 'normal' }
    vi.mocked(parseFontsFromTemplate).mockResolvedValueOnce([fonts400, fonts300])
    const opts = createOpts({ fontRequirements: { ...baseFontReqs, hasDynamicBindings: true } })
    const result = await resolveOgImageFonts(opts)
    expect(result).toEqual([fonts400, fonts300])
  })
})

describe('prepareWoff2Fonts', () => {
  it('converts exact Nuxt Fonts subsets without resolving unrelated weights', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'og-image-nuxt-fonts-'))
    const publicFontsDir = join(rootDir, 'public', 'fonts')
    mkdirSync(publicFontsDir, { recursive: true })

    const sourceDir = join(process.cwd(), 'node_modules', '@fontsource', 'noto-sans-sc', 'files')
    const subsets = [
      ['subset-97.woff2', 'noto-sans-sc-97-400-normal.woff2', 'U+4E00-4E5F'],
      ['subset-98.woff2', 'noto-sans-sc-98-400-normal.woff2', 'U+4E60-4EBF'],
    ] as const
    for (const [publicName, fixtureName] of subsets)
      copyFileSync(join(sourceDir, fixtureName), join(publicFontsDir, publicName))

    vi.mocked(parseFontsFromTemplate).mockResolvedValueOnce(subsets.map(([publicName, , unicodeRange]) => ({
      family: 'Noto Sans SC',
      src: `/_fonts/${publicName}`,
      weight: 400,
      style: 'normal',
      unicodeRange,
    })))

    const resolver = vi.fn()
    const fontState = {
      fallbackMap: new Map<string, string>(),
      sourceMap: new Map<string, string>(),
    }
    const nuxt = {
      options: {
        buildDir: join(rootDir, '.nuxt'),
        dir: { public: 'public' },
        fonts: {
          families: [
            { name: 'Noto Sans SC', provider: 'google', global: true },
          ],
        },
        rootDir,
        srcDir: rootDir,
      },
      _ogImageFontless: {
        resolver,
        renderedFontURLs: new Map(),
        providerNames: ['google', 'bunny', 'fontsource'],
      },
    } as any

    try {
      await prepareWoff2Fonts({
        nuxt,
        logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn() } as any,
        fontRequirements: {
          ...baseFontReqs,
          weights: [400, 700],
          componentMap: {
            CjkCard: { weights: [400], styles: ['normal'], families: ['Noto Sans SC'], hasDynamicBindings: false },
          },
        },
        fontState,
        nuxtFontsContext: {
          assetsBaseURL: '/_fonts',
          renderedFontURLs: new Map(subsets.map(([publicName]) => [publicName, `/fonts/${publicName}`])),
        },
        warnOnMissingStaticFonts: true,
      } as any)

      expect(resolver).not.toHaveBeenCalled()
      expect([...fontState.sourceMap.keys()]).toEqual(subsets.map(([publicName]) => `/_fonts/${publicName}`))
      expect(new Set(fontState.sourceMap.values()).size).toBe(2)
      expect(fontState.fallbackMap.size).toBe(0)
      let outputBytes = 0
      for (const outputSrc of fontState.sourceMap.values()) {
        const output = readFileSync(join(getStaticFontCacheDir(nuxt.options.buildDir), outputSrc.split('/').pop()!))
        outputBytes += output.byteLength
        expect(output.subarray(0, 4)).toEqual(Buffer.from('wOFF'))
      }
      expect(outputBytes).toBeLessThan(20_000)
    }
    finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it('resolves only missing weights used with a provider font', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'og-image-font-weights-'))
    const fallbackUrl = 'data:font/woff;base64,d09GRgAAAAA='
    const resolver = vi.fn().mockResolvedValue({
      fonts: [{
        weight: 700,
        style: 'normal',
        src: [{ url: fallbackUrl, originalURL: fallbackUrl, format: 'woff' }],
      }],
    })
    const fontState = {
      fallbackMap: new Map<string, string>(),
      sourceMap: new Map([['/_fonts/nunito.woff2', '/_og-static-fonts/nunito.woff']]),
    }
    const nuxt = {
      options: {
        buildDir: join(rootDir, '.nuxt'),
        rootDir,
        fonts: { families: [{ name: 'Nunito Sans', provider: 'google', global: true }] },
      },
      _ogImageFontless: {
        resolver,
        renderedFontURLs: new Map(),
        providerNames: ['google', 'bunny', 'fontsource'],
      },
    } as any

    vi.mocked(parseFontsFromTemplate).mockResolvedValueOnce([
      { family: 'Nunito Sans', src: '/_fonts/nunito.woff2', weight: 400, style: 'normal' },
    ])

    try {
      await prepareWoff2Fonts({
        nuxt,
        logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn() } as any,
        fontRequirements: {
          ...baseFontReqs,
          componentMap: {
            VariableCard: { weights: [400, 700], styles: ['normal'], families: ['Nunito Sans'], hasDynamicBindings: false },
          },
        },
        fontState,
      })

      expect(resolver).toHaveBeenCalledWith('Nunito Sans', {
        name: 'Nunito Sans',
        styles: ['normal'],
        weights: [700],
      })
      expect(fontState.fallbackMap).toEqual(new Map([
        ['Nunito Sans-700-normal', '/_og-static-fonts/Nunito_Sans-700-normal.woff'],
      ]))
    }
    finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it('does not resolve provider fallbacks when static fonts are optional', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'og-image-fontless-'))
    const resolver = vi.fn().mockResolvedValue(undefined)
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn() } as any
    const nuxt = {
      options: {
        buildDir: join(rootDir, '.nuxt'),
        rootDir,
        fonts: {
          families: [
            { name: 'Raleway Variable', provider: 'npm', global: true },
          ],
        },
      },
      _ogImageFontless: {
        resolver,
        renderedFontURLs: new Map(),
        providerNames: ['google', 'bunny', 'fontsource'],
      },
    } as any

    vi.mocked(parseFontsFromTemplate).mockResolvedValueOnce([
      { family: 'Raleway Variable', src: '/_fonts/raleway-variable.woff2', weight: 400, style: 'normal' },
    ])

    try {
      await prepareWoff2Fonts({
        nuxt,
        logger,
        fontRequirements: baseFontReqs,
        fontState: { fallbackMap: new Map(), sourceMap: new Map() },
        warnOnMissingStaticFonts: false,
      })

      expect(resolver).not.toHaveBeenCalled()
      expect(logger.warn).not.toHaveBeenCalled()
    }
    finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })
})
