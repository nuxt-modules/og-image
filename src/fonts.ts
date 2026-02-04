import { readFile } from 'node:fs/promises'

/**
 * Check if a TTF/OTF buffer has the fvar table (variable font).
 */
export function isVariableFontData(data: Buffer | Uint8Array): boolean {
  const view = new DataView(
    data.buffer as ArrayBuffer,
    data.byteOffset,
    data.byteLength,
  )
  const numTables = view.getUint16(4)
  for (let i = 0; i < numTables; i++) {
    const offset = 12 + i * 16
    const tag = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    )
    if (tag === 'fvar')
      return true
  }
  return false
}

/**
 * Check if a WOFF2 buffer contains the fvar table by parsing its table directory.
 * fvar is known tag index 47 in the WOFF2 spec.
 * This avoids decompression entirely for variable fonts.
 */
export function isVariableFontWoff2(data: Buffer | Uint8Array): boolean {
  if (data.length < 48)
    return false
  // Verify wOF2 signature
  if (data[0] !== 0x77 || data[1] !== 0x4F || data[2] !== 0x46 || data[3] !== 0x32)
    return false

  const view = new DataView(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength)
  const numTables = view.getUint16(12)
  let offset = 48

  for (let i = 0; i < numTables; i++) {
    if (offset >= data.length)
      return false
    const flags = data[offset++]!
    const tagIndex = flags & 0x3F

    // Custom tag: skip 4-byte tag
    if (tagIndex === 63)
      offset += 4

    // fvar = known tag index 47
    if (tagIndex === 47)
      return true

    // Skip origLength (UIntBase128)
    offset = skipUIntBase128(data, offset)

    // Skip transformLength (UIntBase128) if present
    const transformVersion = (flags >> 6) & 0x03
    // glyf(10)/loca(11): transform applied by default (version 0 = transformed)
    // Others: no transform by default (version 0 = untransformed)
    const hasTransformLength = (tagIndex === 10 || tagIndex === 11)
      ? transformVersion === 0
      : transformVersion !== 0
    if (hasTransformLength)
      offset = skipUIntBase128(data, offset)
  }
  return false
}

function skipUIntBase128(data: Buffer | Uint8Array, offset: number): number {
  for (let i = 0; i < 5; i++) {
    if (offset >= data.length)
      return offset
    if (!(data[offset++]! & 0x80))
      return offset
  }
  return offset
}

/**
 * Check if a font file on disk is a variable font.
 */
export async function isVariableFont(ttfPath: string): Promise<boolean> {
  const data = await readFile(ttfPath)
  return isVariableFontData(data)
}
