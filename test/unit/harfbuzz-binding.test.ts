import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const satoriRequire = createRequire(require.resolve('satori/package.json'))
const createHarfBuzz = satoriRequire('harfbuzzjs/hb.js')
const wrapHarfBuzz = satoriRequire('harfbuzzjs/hbjs.js')
const wasmBytes = readFileSync(satoriRequire.resolve('harfbuzzjs/hb.wasm'))
const fontBytes = readFileSync(new URL('../../src/runtime/public/_og-fonts/inter-400-latin.ttf', import.meta.url))

async function loadBinding(wasm: unknown) {
  vi.resetModules()
  vi.doMock('#og-image/harfbuzz-factory', () => ({ default: createHarfBuzz }))
  vi.doMock('#og-image/harfbuzz-callbacks', () => ({ default: undefined }))
  vi.doMock('#og-image/harfbuzz-adapter', () => ({ default: wrapHarfBuzz }))
  vi.doMock('#og-image/harfbuzz-wasm', () => ({ default: wasm }))
  return (await import('../../src/runtime/server/og-image/bindings/satori/harfbuzz')).default as any
}

describe('harfBuzz binding', () => {
  it.each(['module', 'factory', 'promised module', 'promised factory'])('shapes text with a WASM %s', async (kind) => {
    const module = await WebAssembly.compile(wasmBytes)
    const wasm = kind.includes('factory') ? (imports: WebAssembly.Imports) => WebAssembly.instantiate(module, imports) : module
    const hb = await loadBinding(kind.startsWith('promised') ? Promise.resolve(wasm) : wasm)
    const blob = hb.createBlob(fontBytes)
    const face = hb.createFace(blob, 0)
    const font = hb.createFont(face)
    const buffer = hb.createBuffer()
    buffer.addText('abc')
    buffer.guessSegmentProperties()
    hb.shape(font, buffer)
    const glyphs = buffer.json(font)
    expect(glyphs.map((glyph: { cl: number }) => glyph.cl)).toEqual([0, 1, 2])
    expect(glyphs.every((glyph: { g: number, ax: number }) => glyph.g > 0 && glyph.ax > 0)).toBe(true)
    buffer.destroy()
    font.destroy()
    face.destroy()
    blob.destroy()
  })

  it('rejects when the WASM factory fails', async () => {
    const error = new Error('WASM factory failed')
    await expect(loadBinding(() => Promise.reject(error))).rejects.toBe(error)
  })
})
