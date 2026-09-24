import type { Font } from 'satori'

/** The Noto family that covers each language code Satori reports for text it cannot render. */
const NOTO_FAMILIES: Record<string, string> = {
  'ja-JP': 'Noto Sans JP',
  'ko-KR': 'Noto Sans KR',
  'zh-CN': 'Noto Sans SC',
  'zh-TW': 'Noto Sans TC',
  'zh-HK': 'Noto Sans HK',
  'th-TH': 'Noto Sans Thai',
  'bn-IN': 'Noto Sans Bengali',
  'ar-AR': 'Noto Sans Arabic',
  'ta-IN': 'Noto Sans Tamil',
  'ml-IN': 'Noto Sans Malayalam',
  'he-IL': 'Noto Sans Hebrew',
  'te-IN': 'Noto Sans Telugu',
  'devanagari': 'Noto Sans Devanagari',
  'kannada': 'Noto Sans Kannada',
  'unknown': 'Noto Sans',
}

const FONT_FILE_ORIGIN = 'https://fonts.gstatic.com'
const RE_FONT_FACE = /@font-face\s*\{([^}]*)\}/g
const RE_FAMILY = /font-family:\s*['"]?([^\s;'"][^;'"]*)['"]?;/
const RE_WEIGHT = /font-weight:\s*(\d+)\s*;/
const RE_SRC = /src:\s*url\(([^)]+)\)\s*format\(['"]?(?:truetype|opentype)['"]?\)/

export interface GoogleFontFile {
  family: string
  weight: number
  url: string
}

/**
 * Read the font files from a Google Fonts CSS2 response. Only TrueType and OpenType files
 * served from fonts.gstatic.com are kept, so a tampered response cannot point us elsewhere.
 */
export function parseGoogleFontCss(css: string): GoogleFontFile[] {
  return [...css.matchAll(RE_FONT_FACE)].flatMap(([, rule = '']) => {
    const family = rule.match(RE_FAMILY)?.[1]?.trim()
    const src = rule.match(RE_SRC)?.[1]
    const url = src && URL.canParse(src) ? new URL(src) : undefined
    if (!family || !url || url.origin !== FONT_FILE_ORIGIN)
      return []
    return [{ family, weight: Number(rule.match(RE_WEIGHT)?.[1] || 400), url: url.href }]
  })
}

export interface MissingGlyphLoaderDeps {
  fetchText: (url: string) => Promise<string>
  fetchBuffer: (url: string) => Promise<ArrayBuffer>
  /** Called when a font could not be loaded; the text then renders without it. */
  onError: (family: string, error: Error) => void
}

export type MissingGlyphLoader = (languageCode: string, segment: string) => Promise<Font[]>

/** Runtime titles are arbitrary, so only the most recent character sets stay in memory. */
const MAX_CACHED_SEGMENTS = 100

/**
 * Satori's `loadAdditionalAsset` for text no configured font covers: loads the Noto family for
 * the script from Google Fonts, subset to just those characters.
 */
export function createMissingGlyphLoader(deps: MissingGlyphLoaderDeps): MissingGlyphLoader {
  const loaded = new Map<string, Promise<Font[]>>()
  return async (languageCode, segment) => {
    // Several codes are joined with `|` when Satori cannot tell the language apart, as for Han
    // characters. The first one follows an explicit `lang` attribute when there is one.
    const lang = languageCode.split('|')[0]!
    if (lang === 'emoji')
      return []
    const family = NOTO_FAMILIES[lang] || NOTO_FAMILIES.unknown!
    const key = `${family}\0${segment}`
    let fonts = loaded.get(key)
    if (!fonts) {
      fonts = loadFamily(deps, family, segment, lang === 'unknown' ? undefined : lang)
      if (loaded.size >= MAX_CACHED_SEGMENTS)
        loaded.delete(loaded.keys().next().value!)
      loaded.set(key, fonts)
    }
    return fonts.catch((error: Error) => {
      loaded.delete(key)
      deps.onError(family, error)
      return []
    })
  }
}

async function loadFamily(deps: MissingGlyphLoaderDeps, family: string, text: string, lang: string | undefined): Promise<Font[]> {
  const cssUrl = new URL('https://fonts.googleapis.com/css2')
  cssUrl.searchParams.set('family', `${family}:wght@400;700`)
  cssUrl.searchParams.set('text', text)
  const files = parseGoogleFontCss(await deps.fetchText(cssUrl.href))
  if (!files.length)
    throw new Error(`Google Fonts returned no usable files for ${family}`)
  // Each font only holds `text`, and Satori keeps one font per name, so the name carries it
  return Promise.all(files.map(async file => ({
    name: `${file.family} ${text}`,
    data: await deps.fetchBuffer(file.url),
    weight: file.weight as Font['weight'],
    style: 'normal' as const,
    lang,
  })))
}
