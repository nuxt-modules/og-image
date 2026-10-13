/**
 * Font binaries as renderers receive them.
 *
 * Takumi's WASM build rejects WOFF, and one bad font fails the whole render.
 * The loader inflates WOFF to the TTF or OTF it wraps and rejects bytes that are no font.
 * The decoder only needs `DecompressionStream`, so it runs on Node and edge runtimes.
 */

export type FontBinaryResult
  = | { _tag: 'Ok', data: Uint8Array<ArrayBuffer> }
    | { _tag: 'Err', reason: string }

const WOFF_HEADER_SIZE = 44
const WOFF_TABLE_ENTRY_SIZE = 20
const SFNT_TABLE_RECORD_SIZE = 16
// The largest CJK fonts stay well below this. It bounds a WOFF that declares huge tables.
const MAX_SFNT_SIZE = 64 * 1024 * 1024

const SIGNATURES = {
  truetype: 0x00010000,
  appleTrueType: 0x74727565, // 'true'
  openType: 0x4F54544F, // 'OTTO'
  collection: 0x74746366, // 'ttcf'
  woff: 0x774F4646, // 'wOFF'
  woff2: 0x774F4632, // 'wOF2'
} as const

function toBytes(source: BufferSource): Uint8Array<ArrayBuffer> {
  if (ArrayBuffer.isView(source))
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
  return new Uint8Array(source)
}

function readSignature(data: Uint8Array): number | undefined {
  if (data.byteLength < 4)
    return undefined
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0)
}

/** Inflate one zlib stream that must expand to exactly `size` bytes. */
async function inflate(data: Uint8Array<ArrayBuffer>, size: number): Promise<Uint8Array<ArrayBuffer>> {
  const output = new Uint8Array(size)
  const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate')).getReader()
  let written = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break
    if (written + value.byteLength > size) {
      await reader.cancel()
      throw new Error('a table inflates past its declared size')
    }
    output.set(value, written)
    written += value.byteLength
  }
  if (written !== size)
    throw new Error('a table inflates short of its declared size')
  return output
}

/** Rebuild the TTF or OTF file a WOFF 1.0 file wraps. https://www.w3.org/TR/WOFF/ */
async function decodeWoff(woff: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  if (woff.byteLength < WOFF_HEADER_SIZE)
    throw new Error('the WOFF header is truncated')
  const view = new DataView(woff.buffer, woff.byteOffset, woff.byteLength)
  const flavor = view.getUint32(4)
  const numTables = view.getUint16(12)
  if (numTables === 0)
    throw new Error('the WOFF file has no tables')
  if (WOFF_HEADER_SIZE + numTables * WOFF_TABLE_ENTRY_SIZE > woff.byteLength)
    throw new Error('the WOFF table directory is truncated')

  const tables = Array.from({ length: numTables }, (_, index) => {
    const entry = WOFF_HEADER_SIZE + index * WOFF_TABLE_ENTRY_SIZE
    return {
      tag: view.getUint32(entry),
      offset: view.getUint32(entry + 4),
      compLength: view.getUint32(entry + 8),
      origLength: view.getUint32(entry + 12),
      checksum: view.getUint32(entry + 16),
    }
  })

  const headerSize = 12 + numTables * SFNT_TABLE_RECORD_SIZE
  let sfntSize = headerSize
  for (const table of tables) {
    if (table.offset + table.compLength > woff.byteLength)
      throw new Error('a WOFF table runs past the end of the file')
    if (table.compLength > table.origLength)
      throw new Error('a WOFF table is larger than its decoded size')
    // SFNT tables start on 4-byte boundaries
    sfntSize += (table.origLength + 3) & ~3
  }
  if (sfntSize > MAX_SFNT_SIZE)
    throw new Error(`the decoded font exceeds ${MAX_SFNT_SIZE} bytes`)

  const tableData = await Promise.all(tables.map((table) => {
    const stored = woff.subarray(table.offset, table.offset + table.compLength)
    return table.compLength < table.origLength ? inflate(stored, table.origLength) : stored
  }))

  const sfnt = new Uint8Array(sfntSize)
  const out = new DataView(sfnt.buffer)
  const entrySelector = Math.floor(Math.log2(numTables))
  const searchRange = 2 ** entrySelector * SFNT_TABLE_RECORD_SIZE
  out.setUint32(0, flavor)
  out.setUint16(4, numTables)
  out.setUint16(6, searchRange)
  out.setUint16(8, entrySelector)
  out.setUint16(10, numTables * SFNT_TABLE_RECORD_SIZE - searchRange)
  let offset = headerSize
  tables.forEach((table, index) => {
    const record = 12 + index * SFNT_TABLE_RECORD_SIZE
    out.setUint32(record, table.tag)
    out.setUint32(record + 4, table.checksum)
    out.setUint32(record + 8, offset)
    out.setUint32(record + 12, table.origLength)
    sfnt.set(tableData[index]!, offset)
    offset += (table.origLength + 3) & ~3
  })
  return sfnt
}

/**
 * Parse loaded font bytes into a binary that Satori and every Takumi build accept.
 * TTF, OTF, font collections and WOFF2 pass through; WOFF inflates to TTF or OTF.
 */
export async function parseFontBinary(source: BufferSource): Promise<FontBinaryResult> {
  const data = toBytes(source)
  switch (readSignature(data)) {
    case SIGNATURES.truetype:
    case SIGNATURES.appleTrueType:
    case SIGNATURES.openType:
    case SIGNATURES.collection:
    case SIGNATURES.woff2:
      return { _tag: 'Ok', data }
    case SIGNATURES.woff:
      return decodeWoff(data).then(
        (sfnt): FontBinaryResult => ({ _tag: 'Ok', data: sfnt }),
        (error: Error): FontBinaryResult => ({ _tag: 'Err', reason: `it is a WOFF file that could not be decoded: ${error.message}` }),
      )
    default:
      return { _tag: 'Err', reason: 'it is not a TTF, OTF, WOFF or WOFF2 file' }
  }
}
