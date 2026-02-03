import { readFile } from 'node:fs/promises'

/**
 * Check if a font has variation tables (variable font).
 * Variable fonts use fvar table to define variation axes like weight.
 */
export async function isVariableFont(ttfPath: string): Promise<boolean> {
  const data = await readFile(ttfPath)
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)

  const numTables = view.getUint16(4)
  const tableRecordStart = 12

  for (let i = 0; i < numTables; i++) {
    const offset = tableRecordStart + i * 16
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
