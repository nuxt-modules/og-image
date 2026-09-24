import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import satori from 'satori'
import { describe, expect, it } from 'vitest'
import { loadFontInstancer } from '../../src/build/font-instancer'
import { woff2Decode } from '../../src/build/woff2/decode'

// Inter 4 variable (wght 100-900, opsz 14-32), latin subset, as Google Fonts serves it
const variableFont = woff2Decode(readFileSync(new URL('./fixtures/fonts/InterVariable-latin.woff2', import.meta.url)))

function readTable(font: Uint8Array, tag: string): DataView | undefined {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength)
  for (let index = 0; index < view.getUint16(4); index++) {
    const record = 12 + index * 16
    if (String.fromCharCode(...font.subarray(record, record + 4)) === tag)
      return new DataView(font.buffer, font.byteOffset + view.getUint32(record + 8), view.getUint32(record + 12))
  }
}

const weightClass = (font: Uint8Array) => readTable(font, 'OS/2')!.getUint16(4)
const glyphCount = (font: Uint8Array) => readTable(font, 'maxp')!.getUint16(4)

async function instancer() {
  const loaded = await loadFontInstancer([import.meta.url])
  if (loaded._tag !== 'Ok')
    throw new Error('harfbuzzjs should resolve through satori')
  return loaded.instancer
}

describe('loadFontInstancer', () => {
  it('pins a variable font to one static weight', async () => {
    const result = (await instancer()).instance(variableFont, 700)

    expect(result._tag).toBe('Ok')
    const font = (result as { data: Uint8Array }).data
    expect(readTable(font, 'fvar')).toBeUndefined()
    expect(weightClass(font)).toBe(700)
  })

  it('keeps every glyph of the served file', async () => {
    const result = (await instancer()).instance(variableFont, 400)

    expect(glyphCount((result as { data: Uint8Array }).data)).toBe(glyphCount(variableFont))
  })

  it('produces fonts Satori renders at their own weight', async () => {
    const { instance } = await instancer()
    const render = (weight: 400 | 700) => {
      const data = (instance(variableFont, weight) as { data: Uint8Array }).data
      return satori({ type: 'div', props: { style: { fontFamily: 'Inter', fontWeight: weight }, children: 'Hello' } }, {
        width: 400,
        height: 100,
        fonts: [{ name: 'Inter', data: Buffer.from(data), weight, style: 'normal' }],
      })
    }

    const [regular, bold] = await Promise.all([render(400), render(700)])
    expect(regular).toContain('<path')
    expect(bold).not.toBe(regular)
  })

  it('reports harfbuzzjs as missing when nothing provides it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-image-no-harfbuzz-'))
    try {
      expect(await loadFontInstancer([pathToFileURL(`${dir}/`)])).toEqual({ _tag: 'Missing' })
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
