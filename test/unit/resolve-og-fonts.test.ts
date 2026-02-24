import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getStaticInterFonts } from '../../src/build/fonts'

// Mock parseFontsFromTemplate to avoid needing real nuxt instance
vi.mock('../../src/build/fonts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/build/fonts')>()
  return {
    ...mod,
    parseFontsFromTemplate: vi.fn().mockResolvedValue([]),
  }
})

const { resolveOgImageFonts } = await import('../../src/build/fontless')
const { parseFontsFromTemplate } = await import('../../src/build/fonts')

const baseFontReqs = { weights: [400, 700], styles: ['normal' as const], families: [] as string[], hasDynamicBindings: false, componentMap: {} }

function createOpts(overrides: Record<string, any> = {}) {
  // Fresh nuxt mock per call to avoid cache leakage
  return {
    nuxt: { options: { buildDir: '/tmp/test', rootDir: '/tmp' } } as any,
    hasNuxtFonts: true,
    hasSatoriRenderer: false,
    convertedWoff2Files: new Set<string>(),
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

  it('returns fonts with satoriSrc for satori renderer', async () => {
    const staticFont = { family: 'Inter', src: '/inter.ttf', weight: 400, style: 'normal', satoriSrc: '/inter.ttf' }
    vi.mocked(parseFontsFromTemplate).mockResolvedValueOnce([staticFont])
    const opts = createOpts({ hasSatoriRenderer: true })
    const fonts = await resolveOgImageFonts(opts)
    expect(fonts).toEqual([staticFont])
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
