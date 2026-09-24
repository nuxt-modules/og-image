import { describe, expect, it, vi } from 'vitest'
import { createMissingGlyphLoader, parseGoogleFontCss } from '../../src/runtime/server/og-image/satori/missing-glyphs'

// A real response from fonts.googleapis.com/css2 for a client without WOFF2 support
const NOTO_SANS_JP_CSS = `@font-face {
  font-family: 'Noto Sans JP';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/l/font?kit=-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75vA0Fe-KyMV8g&skey=72472b0eb8793570&v=v56) format('truetype');
}
@font-face {
  font-family: 'Noto Sans JP';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/l/font?kit=-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFPYk75vA0Fe-KyMV8g&skey=72472b0eb8793570&v=v56) format('truetype');
}
`

function createDeps(css = NOTO_SANS_JP_CSS) {
  const fetchText = vi.fn(async (_url: string) => css)
  const fetchBuffer = vi.fn(async (url: string) => new TextEncoder().encode(url).buffer as ArrayBuffer)
  const onError = vi.fn()
  return { fetchText, fetchBuffer, onError }
}

describe('parseGoogleFontCss', () => {
  it('reads each font file and its weight', () => {
    expect(parseGoogleFontCss(NOTO_SANS_JP_CSS)).toEqual([
      { family: 'Noto Sans JP', weight: 400, url: expect.stringMatching(/^https:\/\/fonts\.gstatic\.com\/l\/font\?kit=-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj/) },
      { family: 'Noto Sans JP', weight: 700, url: expect.stringMatching(/^https:\/\/fonts\.gstatic\.com\/l\/font\?kit=-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFPYk/) },
    ])
  })

  it('drops files that are not on fonts.gstatic.com', () => {
    const css = NOTO_SANS_JP_CSS
      .replace('https://fonts.gstatic.com/l/font?kit=-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj', 'http://169.254.169.254/latest/meta-data?x=')
      .replace('https://fonts.gstatic.com/l/font?kit=-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFPYk', 'https://fonts.gstatic.com.evil.test/font?kit=')
    expect(parseGoogleFontCss(css)).toEqual([])
  })
})

describe('createMissingGlyphLoader', () => {
  it('loads a Noto font subset to the missing characters', async () => {
    const deps = createDeps()
    const load = createMissingGlyphLoader(deps)

    const fonts = await load('ja-JP', 'こんにちは')

    const cssUrl = new URL(deps.fetchText.mock.calls[0]![0])
    expect(cssUrl.origin).toBe('https://fonts.googleapis.com')
    expect(cssUrl.searchParams.get('family')).toBe('Noto Sans JP:wght@400;700')
    expect(cssUrl.searchParams.get('text')).toBe('こんにちは')
    expect(fonts.map(({ weight, style, lang }) => ({ weight, style, lang }))).toEqual([
      { weight: 400, style: 'normal', lang: 'ja-JP' },
      { weight: 700, style: 'normal', lang: 'ja-JP' },
    ])
  })

  it('names each subset apart so Satori keeps both', async () => {
    // Satori reports hiragana and Han characters separately, and both need Noto Sans JP
    const load = createMissingGlyphLoader(createDeps())
    const [kana] = await load('ja-JP', 'こんにちは')
    const [han] = await load('ja-JP|zh-CN|zh-TW', '日本語')
    expect(kana!.name).not.toBe(han!.name)
  })

  it('uses the first language when Satori is not sure', async () => {
    const deps = createDeps()
    await createMissingGlyphLoader(deps)('zh-CN|ja-JP|zh-TW', '中文')
    expect(new URL(deps.fetchText.mock.calls[0]![0]).searchParams.get('family')).toBe('Noto Sans SC:wght@400;700')
  })

  it('falls back to Noto Sans for unknown scripts', async () => {
    const deps = createDeps()
    await createMissingGlyphLoader(deps)('unknown', 'Ω')
    expect(new URL(deps.fetchText.mock.calls[0]![0]).searchParams.get('family')).toBe('Noto Sans:wght@400;700')
  })

  it('leaves emoji to the emoji support', async () => {
    const deps = createDeps()
    expect(await createMissingGlyphLoader(deps)('emoji', '👋')).toEqual([])
    expect(deps.fetchText).not.toHaveBeenCalled()
  })

  it('fetches the same characters once', async () => {
    const deps = createDeps()
    const load = createMissingGlyphLoader(deps)
    await load('ar-AR', 'مرحبا')
    await load('ar-AR', 'مرحبا')
    expect(deps.fetchText).toHaveBeenCalledTimes(1)
  })

  it('reports a failed fetch and renders without the font', async () => {
    const deps = createDeps()
    deps.fetchText.mockRejectedValueOnce(new Error('network down'))
    expect(await createMissingGlyphLoader(deps)('ar-AR', 'مرحبا')).toEqual([])
    expect(deps.onError).toHaveBeenCalledWith('Noto Sans Arabic', expect.objectContaining({ message: 'network down' }))
  })

  it('retries characters whose fetch failed', async () => {
    const deps = createDeps()
    deps.fetchText.mockRejectedValueOnce(new Error('network down'))
    const load = createMissingGlyphLoader(deps)
    await load('ar-AR', 'مرحبا')
    expect(await load('ar-AR', 'مرحبا')).toHaveLength(2)
  })
})
