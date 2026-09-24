import { readFile } from 'node:fs/promises'
import { resolveModulePath } from 'exsolve'

/** A static TrueType font, or why HarfBuzz could not produce one. */
export type InstanceResult
  = | { _tag: 'Ok', data: Uint8Array }
    | { _tag: 'Err', reason: string }

export interface FontInstancer {
  /**
   * Pin a TrueType or OpenType font to `weight`, and its other axes to their defaults. The
   * result has no variation tables, so Satori can read it. Every glyph is kept: the files
   * @nuxt/fonts serves are already subset to their unicode range.
   */
  instance: (font: Uint8Array, weight: number) => InstanceResult
}

export type InstancerResult
  = | { _tag: 'Ok', instancer: FontInstancer }
    | { _tag: 'Missing' }

/** The HarfBuzz subsetter wasm, in the harfbuzzjs 0.x and 1.x package layouts. */
const SUBSET_WASM = ['harfbuzzjs/hb-subset.wasm', 'harfbuzzjs/dist/harfbuzz-subset.wasm']

/**
 * Find the HarfBuzz subsetter. Satori depends on harfbuzzjs from 0.33, and subset-font (used
 * by @nuxt/fonts for `glyphs`) depends on it too, so a project rarely has to install it.
 */
function resolveSubsetWasm(from: Array<string | URL>): string | undefined {
  const owners = ['satori/package.json', 'subset-font/package.json']
    .map(pkg => resolveModulePath(pkg, { from, try: true }))
    .filter((path): path is string => !!path)
  for (const base of [from, ...owners.map(owner => [owner])]) {
    for (const wasm of SUBSET_WASM) {
      const path = resolveModulePath(wasm, { from: base, try: true })
      if (path)
        return path
    }
  }
}

interface HarfBuzzSubset {
  memory: WebAssembly.Memory
  _initialize: () => void
  malloc: (size: number) => number
  free: (pointer: number) => void
  hb_blob_create: (data: number, length: number, mode: number, userData: number, destroy: number) => number
  hb_blob_destroy: (blob: number) => void
  hb_blob_get_data: (blob: number, length: number) => number
  hb_blob_get_length: (blob: number) => number
  hb_face_create: (blob: number, index: number) => number
  hb_face_destroy: (face: number) => void
  hb_face_reference_blob: (face: number) => number
  hb_subset_input_create_or_fail: () => number
  hb_subset_input_destroy: (input: number) => void
  hb_subset_input_keep_everything: (input: number) => void
  hb_subset_input_pin_all_axes_to_default: (input: number, face: number) => number
  hb_subset_input_pin_axis_location: (input: number, face: number, tag: number, value: number) => number
  hb_subset_or_fail: (face: number, input: number) => number
}

const HB_MEMORY_MODE_WRITABLE = 2
const WGHT = 0x77676874

function instanceFont(hb: HarfBuzzSubset, font: Uint8Array, weight: number): InstanceResult {
  const input = hb.hb_subset_input_create_or_fail()
  if (!input)
    return { _tag: 'Err', reason: 'HarfBuzz could not create a subset input' }
  const pointer = hb.malloc(font.byteLength)
  new Uint8Array(hb.memory.buffer).set(font, pointer)
  const blob = hb.hb_blob_create(pointer, font.byteLength, HB_MEMORY_MODE_WRITABLE, 0, 0)
  const face = hb.hb_face_create(blob, 0)
  hb.hb_blob_destroy(blob)
  try {
    hb.hb_subset_input_keep_everything(input)
    hb.hb_subset_input_pin_all_axes_to_default(input, face)
    // A font without a weight axis keeps its default instance
    hb.hb_subset_input_pin_axis_location(input, face, WGHT, weight)
    const subset = hb.hb_subset_or_fail(face, input)
    if (!subset)
      return { _tag: 'Err', reason: 'HarfBuzz could not instance the font' }
    const result = hb.hb_face_reference_blob(subset)
    const offset = hb.hb_blob_get_data(result, 0)
    const length = hb.hb_blob_get_length(result)
    // The wasm memory may have grown, so read through a fresh view
    const data = new Uint8Array(hb.memory.buffer).slice(offset, offset + length)
    hb.hb_blob_destroy(result)
    hb.hb_face_destroy(subset)
    return length > 0 ? { _tag: 'Ok', data } : { _tag: 'Err', reason: 'HarfBuzz returned an empty font' }
  }
  finally {
    hb.hb_subset_input_destroy(input)
    hb.hb_face_destroy(face)
    hb.free(pointer)
  }
}

/** Load HarfBuzz from the first of `from` that provides it, directly or through Satori. */
export async function loadFontInstancer(from: Array<string | URL>): Promise<InstancerResult> {
  const path = resolveSubsetWasm(from)
  if (!path)
    return { _tag: 'Missing' }
  const { instance } = await WebAssembly.instantiate(await readFile(path))
  const hb = instance.exports as unknown as HarfBuzzSubset
  hb._initialize()
  return { _tag: 'Ok', instancer: { instance: (font, weight) => instanceFont(hb, font, weight) } }
}
