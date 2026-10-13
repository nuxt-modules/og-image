import { readFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'
import { initSync, Renderer } from '@takumi-rs/wasm'
import { resolveModulePath } from 'exsolve'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { parseFontBinary } from '../../src/runtime/server/og-image/font-binary'

const fontsDir = new URL('../../node_modules/@fontsource/noto-sans-sc/files/', import.meta.url)
const readFont = async (file: string) => new Uint8Array(await readFile(new URL(file, fontsDir)))

function woffWithTableLengths(lengths: number[]): Uint8Array {
  const compressed = deflateSync(new Uint8Array([0]))
  const directorySize = 44 + lengths.length * 20
  const woff = new Uint8Array(directorySize + compressed.byteLength)
  const view = new DataView(woff.buffer)
  view.setUint32(0, 0x774F4646)
  view.setUint32(4, 0x00010000)
  view.setUint32(8, woff.byteLength)
  view.setUint16(12, lengths.length)
  lengths.forEach((length, index) => {
    const entry = 44 + index * 20
    view.setUint32(entry, 0x68656164 + index)
    view.setUint32(entry + 4, directorySize)
    view.setUint32(entry + 8, compressed.byteLength)
    view.setUint32(entry + 12, length)
  })
  woff.set(compressed, directorySize)
  return woff
}

async function parsed(data: Uint8Array): Promise<Uint8Array> {
  const result = await parseFontBinary(data)
  if (result._tag === 'Err')
    throw new Error(result.reason)
  return result.data
}

/** Render text with Takumi's WASM build and return the raw RGBA pixels. */
async function renderWasm(data: Uint8Array, fontWeight: number): Promise<Uint8Array> {
  const renderer = new Renderer()
  return renderer.render({
    type: 'container',
    style: { display: 'flex', width: '100%', height: '100%', backgroundColor: 'white' },
    children: [{ type: 'text', text: 'Hamburgefonstiv', style: { fontFamily: 'Noto', fontWeight, fontSize: 48, color: 'black' } }],
  }, {
    width: 480,
    height: 80,
    format: 'raw',
    fonts: [{ name: 'Noto', data, weight: fontWeight, style: 'normal' }],
    fontFamilies: ['Noto'],
  })
}

beforeAll(async () => {
  initSync({ module: await readFile(resolveModulePath('@takumi-rs/wasm/takumi_wasm_bg.wasm')) })
})

describe('parseFontBinary', () => {
  it.each([
    [0x7FFFFFFF],
    [0x80000000],
    [0xFFFFFFF0],
    [0xFFFFFFFF],
    [32 * 1024 * 1024, 32 * 1024 * 1024],
    [0xFFFFFFF0, 64 * 1024 * 1024],
  ])('rejects oversized WOFF tables before allocating decoded bytes (%j)', async (...lengths) => {
    const woff = woffWithTableLengths(lengths)
    const allocations: number[] = []
    vi.stubGlobal('Uint8Array', new Proxy(Uint8Array, {
      construct(target, args) {
        // Stop a regressed decoder from allocating gigabytes during the test.
        if (typeof args[0] === 'number' && args[0] > 1024 * 1024) {
          allocations.push(args[0])
          throw new Error('The test blocked an oversized allocation')
        }
        return Reflect.construct(target, args)
      },
    }))
    const result = await parseFontBinary(woff).finally(() => vi.unstubAllGlobals())
    expect(result).toMatchObject({ _tag: 'Err', reason: expect.stringContaining('exceeds 67108864 bytes') })
    expect(allocations).toEqual([])
  })

  it.each([400, 700])('turns a WOFF file into a font Takumi WASM renders like its WOFF2 (weight %i)', async (weight) => {
    const woff = await readFont(`noto-sans-sc-latin-${weight}-normal.woff`)
    const woff2 = await readFont(`noto-sans-sc-latin-${weight}-normal.woff2`)
    await expect(renderWasm(woff, weight)).rejects.toThrow('Unsupported font format')
    const [fromWoff, fromWoff2] = await Promise.all([
      renderWasm(await parsed(woff), weight),
      renderWasm(await parsed(woff2), weight),
    ])
    expect(fromWoff.some(channel => channel < 128)).toBe(true)
    expect(Buffer.from(fromWoff).equals(Buffer.from(fromWoff2))).toBe(true)
  })

  it('rejects bytes that are no font', async () => {
    const result = await parseFontBinary(new TextEncoder().encode('<!doctype html><title>404</title>'))
    expect(result).toEqual({ _tag: 'Err', reason: 'it is not a TTF, OTF, WOFF or WOFF2 file' })
  })

  it('rejects a truncated WOFF file', async () => {
    const woff = await readFont('noto-sans-sc-latin-400-normal.woff')
    const result = await parseFontBinary(woff.subarray(0, 2000))
    expect(result._tag).toBe('Err')
  })

  it('rejects a WOFF table that inflates past its declared size', async () => {
    const woff = await readFont('noto-sans-sc-latin-400-normal.woff')
    const view = new DataView(woff.buffer, woff.byteOffset, woff.byteLength)
    const tables = view.getUint16(12)
    const compressed = Array.from({ length: tables }, (_, index) => 44 + index * 20)
      .find(entry => view.getUint32(entry + 8) < view.getUint32(entry + 12))!
    view.setUint32(compressed + 12, view.getUint32(compressed + 8) + 1)
    const result = await parseFontBinary(woff)
    expect(result).toMatchObject({ _tag: 'Err', reason: expect.stringContaining('past its declared size') })
  })
})
