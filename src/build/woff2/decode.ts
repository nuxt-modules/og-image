// eslint-disable-next-line ts/ban-ts-comment -- vendored parser performs explicit bounds checks that TS cannot narrow
// @ts-nocheck
/**
 * Adapted from woff-lib 0.0.3:
 * https://github.com/countertype/woff-lib
 *
 * Copyright (c) 2013-2017 by the WOFF2 Authors
 * Copyright (c) 2026 Jeremy Tribby, Countertype LLC
 * MIT licensed. See THIRD_PARTY_NOTICES.md.
 * Bounds checks are explicit; TypeScript cannot narrow typed-array indexing.
 */

// WOFF2 decoder
// https://www.w3.org/TR/WOFF2/

import type { ReadBuffer } from './read-buffer'
import { brotliDecompressSync } from 'node:zlib'
import { computeChecksum, pad4 } from './checksum'
import {
  KNOWN_TAGS,
  TAG_GLYF,
  TAG_HEAD,
  TAG_HHEA,
  TAG_HMTX,
  TAG_LOCA,
  tagToString,
  TTC_FLAVOR,
  WOFF2_FLAGS_TRANSFORM,
  WOFF2_SIGNATURE,
} from './known-tags'
import { createReadBuffer } from './read-buffer'
import { read255UShort, readBase128 } from './variable-length'

// SFNT constants
const SFNT_HEADER_SIZE = 12
const SFNT_ENTRY_SIZE = 16

// TrueType glyph point encoding flags
const FLAG_ON_CURVE = 1
const FLAG_X_SHORT = 1 << 1
const FLAG_Y_SHORT = 1 << 2
const FLAG_REPEAT = 1 << 3
const FLAG_X_SAME = 1 << 4
const FLAG_Y_SAME = 1 << 5
const FLAG_OVERLAP_SIMPLE = 1 << 6

interface Table {
  tag: number
  flags: number
  origLength: number
  transformLength: number
  srcOffset: number
  srcLength: number
  dstOffset: number
  dstLength: number
  key: string
}

interface FontInfo {
  numGlyphs: number
  indexFormat: number
  numHMetrics: number
  xMins: Int16Array
  tableEntryByTag: Map<number, number>
}

interface TtcFont {
  flavor: number
  dstOffset: number
  headerChecksum: number
  tableIndices: number[]
}

interface Woff2Header {
  flavor: number
  headerVersion: number
  numTables: number
  compressedOffset: number
  compressedLength: number
  uncompressedSize: number
  tables: Table[]
  ttcFonts: TtcFont[]
}

// Decode WOFF2 to TTF/OTF format
export function woff2Decode(data: ArrayBuffer | Uint8Array): Uint8Array {
  const input = data instanceof Uint8Array ? data : new Uint8Array(data)
  const buf = createReadBuffer(input)

  // Read and validate header
  const header = readHeader(buf, input.byteLength)
  if (!header) {
    throw new Error('Failed to read WOFF2 header')
  }

  // Decompress table data
  const compressedData = input.subarray(
    header.compressedOffset,
    header.compressedOffset + header.compressedLength,
  )

  const brotli = brotliDecompressSync(compressedData)
  const decompressed = new Uint8Array(brotli.buffer, brotli.byteOffset, brotli.byteLength)
  if (decompressed.byteLength !== header.uncompressedSize) {
    throw new Error(
      `Brotli decompression failed: expected ${header.uncompressedSize} bytes, got ${decompressed.byteLength}`,
    )
  }

  // Calculate output size
  const firstTableOffset = computeOffsetToFirstTable(header)
  let outputSize = firstTableOffset
  for (const table of header.tables) {
    outputSize += table.origLength
    outputSize += (4 - (table.origLength % 4)) % 4 // padding
  }

  // Allocate output buffer
  const output = new Uint8Array(outputSize)
  const outView = new DataView(output.buffer)

  // Write headers
  const fontInfos = writeHeaders(header, output, outView)

  // Track written tables by tag/srcOffset for TTC table sharing
  const writtenTables = new Map<string, { dstOffset: number, dstLength: number, checksum: number }>()
  let nextTableOffset = computeOffsetToFirstTable(header)

  // Reconstruct font(s)
  if (header.ttcFonts.length > 0) {
    // TTC - multiple fonts
    for (let i = 0; i < header.ttcFonts.length; i++) {
      nextTableOffset = reconstructFont(
        decompressed,
        header,
        i,
        fontInfos[i],
        output,
        outView,
        writtenTables,
        nextTableOffset,
      )
    }
  }
  else {
    // Single font
    reconstructFont(
      decompressed,
      header,
      0,
      fontInfos[0],
      output,
      outView,
      writtenTables,
      nextTableOffset,
    )
  }

  return output
}

function readHeader(buf: ReadBuffer, totalLength: number): Woff2Header | null {
  const signature = buf.readU32()
  if (signature !== WOFF2_SIGNATURE) {
    return null
  }

  const flavor = buf.readU32()
  if (flavor === null)
    return null

  const length = buf.readU32()
  if (length === null || length !== totalLength)
    return null

  const numTables = buf.readU16()
  if (numTables === null || numTables === 0)
    return null

  // Skip reserved
  if (!buf.skip(2))
    return null

  // Skip totalSfntSize (we compute it ourselves)
  if (!buf.skip(4))
    return null

  const compressedLength = buf.readU32()
  if (compressedLength === null)
    return null

  // Skip majorVersion, minorVersion
  if (!buf.skip(4))
    return null

  const metaOffset = buf.readU32()
  const metaLength = buf.readU32()
  const metaOrigLength = buf.readU32()
  if (metaOffset === null || metaLength === null || metaOrigLength === null)
    return null

  if (metaOffset !== 0) {
    if (metaOffset >= totalLength || totalLength - metaOffset < metaLength) {
      return null
    }
  }

  const privOffset = buf.readU32()
  const privLength = buf.readU32()
  if (privOffset === null || privLength === null)
    return null

  if (privOffset !== 0) {
    if (privOffset >= totalLength || totalLength - privOffset < privLength) {
      return null
    }
  }

  // Read table directory
  const tables = readTableDirectory(buf, numTables)
  if (!tables)
    return null

  // Calculate uncompressed size from last table
  const lastTable = tables[tables.length - 1]
  const uncompressedSize = lastTable.srcOffset + lastTable.srcLength

  let headerVersion = 0
  const ttcFonts: TtcFont[] = []

  // Handle TTC (font collection)
  if (flavor === TTC_FLAVOR) {
    headerVersion = buf.readU32() ?? 0
    if (headerVersion !== 0x00010000 && headerVersion !== 0x00020000) {
      return null
    }

    const numFonts = read255UShort(buf)
    if (numFonts === null || numFonts === 0)
      return null

    for (let i = 0; i < numFonts; i++) {
      const fontNumTables = read255UShort(buf)
      if (fontNumTables === null || fontNumTables === 0)
        return null

      const fontFlavor = buf.readU32()
      if (fontFlavor === null)
        return null

      const tableIndices: number[] = []
      for (let j = 0; j < fontNumTables; j++) {
        const idx = read255UShort(buf)
        if (idx === null || idx >= tables.length)
          return null
        tableIndices.push(idx)
      }

      ttcFonts.push({
        flavor: fontFlavor,
        dstOffset: 0,
        headerChecksum: 0,
        tableIndices,
      })
    }
  }

  return {
    flavor,
    headerVersion,
    numTables,
    compressedOffset: buf.offset,
    compressedLength,
    uncompressedSize,
    tables,
    ttcFonts,
  }
}

function readTableDirectory(buf: ReadBuffer, numTables: number): Table[] | null {
  const tables: Table[] = []
  let srcOffset = 0

  for (let i = 0; i < numTables; i++) {
    const flagByte = buf.readU8()
    if (flagByte === null)
      return null

    let tag: number
    if ((flagByte & 0x3F) === 0x3F) {
      // Arbitrary tag follows
      tag = buf.readU32() ?? 0
      if (tag === 0)
        return null
    }
    else {
      tag = KNOWN_TAGS[flagByte & 0x3F]
    }

    const xformVersion = (flagByte >> 6) & 0x03
    let flags = 0

    // glyf/loca: xform version 0 means transform applied
    // others: xform version != 0 means transform applied
    if (tag === TAG_GLYF || tag === TAG_LOCA) {
      if (xformVersion === 0) {
        flags |= WOFF2_FLAGS_TRANSFORM
      }
    }
    else if (xformVersion !== 0) {
      flags |= WOFF2_FLAGS_TRANSFORM
    }
    flags |= xformVersion

    const origLength = readBase128(buf)
    if (origLength === null)
      return null

    let transformLength = origLength
    if ((flags & WOFF2_FLAGS_TRANSFORM) !== 0) {
      transformLength = readBase128(buf) ?? 0
      if (transformLength === 0 && tag !== TAG_LOCA)
        return null
      if (tag === TAG_LOCA && transformLength !== 0)
        return null
    }

    tables.push({
      tag,
      flags,
      origLength,
      transformLength,
      srcOffset,
      srcLength: transformLength,
      dstOffset: 0,
      dstLength: origLength,
      key: `${tag}:${srcOffset}`,
    })

    srcOffset += transformLength
  }

  return tables
}

function computeOffsetToFirstTable(header: Woff2Header): number {
  if (header.ttcFonts.length === 0) {
    return SFNT_HEADER_SIZE + SFNT_ENTRY_SIZE * header.numTables
  }

  // TTC header size
  let offset = 12 // ttcTag, version, numFonts
  offset += 4 * header.ttcFonts.length // offset table
  if (header.headerVersion === 0x00020000) {
    offset += 12 // DSIG fields
  }

  // Offset tables for each font
  for (const ttcFont of header.ttcFonts) {
    offset += SFNT_HEADER_SIZE
    offset += SFNT_ENTRY_SIZE * ttcFont.tableIndices.length
  }

  return offset
}

function writeHeaders(
  header: Woff2Header,
  output: Uint8Array,
  outView: DataView,
): FontInfo[] {
  const fontInfos: FontInfo[] = []
  let offset = 0

  if (header.ttcFonts.length > 0) {
    // TTC header
    outView.setUint32(offset, header.flavor) // ttcTag
    offset += 4
    outView.setUint32(offset, header.headerVersion)
    offset += 4
    outView.setUint32(offset, header.ttcFonts.length)
    offset += 4

    const offsetTableStart = offset
    offset += 4 * header.ttcFonts.length // Space for offset table

    if (header.headerVersion === 0x00020000) {
      // DSIG fields (zeroed)
      offset += 12
    }

    // Write each font's offset table
    for (let i = 0; i < header.ttcFonts.length; i++) {
      const ttcFont = header.ttcFonts[i]
      outView.setUint32(offsetTableStart + i * 4, offset)
      ttcFont.dstOffset = offset

      const numTables = ttcFont.tableIndices.length
      offset = writeOffsetTable(outView, offset, ttcFont.flavor, numTables)

      // Sort table indices by tag for this font
      const sortedIndices = [...ttcFont.tableIndices].sort(
        (a, b) => header.tables[a].tag - header.tables[b].tag,
      )

      const tableEntryByTag = new Map<number, number>()
      for (const tableIdx of sortedIndices) {
        const table = header.tables[tableIdx]
        tableEntryByTag.set(table.tag, offset)
        offset = writeTableEntry(outView, offset, table.tag)
      }

      // Update tableIndices to sorted order for later reconstruction
      ttcFont.tableIndices = sortedIndices

      ttcFont.headerChecksum = computeChecksum(
        output,
        ttcFont.dstOffset,
        offset - ttcFont.dstOffset,
      )

      fontInfos.push({
        numGlyphs: 0,
        indexFormat: 0,
        numHMetrics: 0,
        xMins: new Int16Array(0),
        tableEntryByTag,
      })
    }
  }
  else {
    // Single font
    offset = writeOffsetTable(outView, offset, header.flavor, header.numTables)

    // Sort tables by tag for output
    const sortedTables = [...header.tables].sort((a, b) => a.tag - b.tag)
    const tableEntryByTag = new Map<number, number>()

    for (const table of sortedTables) {
      tableEntryByTag.set(table.tag, offset)
      offset = writeTableEntry(outView, offset, table.tag)
    }

    fontInfos.push({
      numGlyphs: 0,
      indexFormat: 0,
      numHMetrics: 0,
      xMins: new Int16Array(0),
      tableEntryByTag,
    })
  }

  return fontInfos
}

function writeOffsetTable(
  view: DataView,
  offset: number,
  flavor: number,
  numTables: number,
): number {
  view.setUint32(offset, flavor)
  view.setUint16(offset + 4, numTables)

  let maxPow2 = 0
  while ((1 << (maxPow2 + 1)) <= numTables) {
    maxPow2++
  }
  const searchRange = (1 << maxPow2) * 16

  view.setUint16(offset + 6, searchRange)
  view.setUint16(offset + 8, maxPow2)
  view.setUint16(offset + 10, numTables * 16 - searchRange)

  return offset + SFNT_HEADER_SIZE
}

function writeTableEntry(view: DataView, offset: number, tag: number): number {
  view.setUint32(offset, tag)
  view.setUint32(offset + 4, 0) // checksum placeholder
  view.setUint32(offset + 8, 0) // offset placeholder
  view.setUint32(offset + 12, 0) // length placeholder
  return offset + SFNT_ENTRY_SIZE
}

function reconstructFont(
  decompressed: Uint8Array,
  header: Woff2Header,
  fontIndex: number,
  fontInfo: FontInfo,
  output: Uint8Array,
  outView: DataView,
  writtenTables: Map<string, { dstOffset: number, dstLength: number, checksum: number }>,
  dstOffset: number,
): number {
  const tables
    = header.ttcFonts.length > 0
      ? header.ttcFonts[fontIndex].tableIndices.map(i => header.tables[i])
      : header.tables

  // Sort tables for processing
  const sortedTables = [...tables].sort((a, b) => a.tag - b.tag)

  // First pass: find glyf/loca and hhea for metadata
  const glyfTable = sortedTables.find(t => t.tag === TAG_GLYF)
  const locaTable = sortedTables.find(t => t.tag === TAG_LOCA)
  const hheaTable = sortedTables.find(t => t.tag === TAG_HHEA)

  if (hheaTable) {
    const hheaData = decompressed.subarray(
      hheaTable.srcOffset,
      hheaTable.srcOffset + hheaTable.srcLength,
    )
    if (hheaData.byteLength >= 36) {
      const hheaView = new DataView(hheaData.buffer, hheaData.byteOffset)
      fontInfo.numHMetrics = hheaView.getUint16(34)
    }
  }

  // Initialize font checksum for TTC (for single fonts, we compute at the end)
  let fontChecksum = header.ttcFonts.length > 0
    ? header.ttcFonts[fontIndex].headerChecksum
    : 0
  const isTTC = header.ttcFonts.length > 0

  // Write each table
  for (const table of sortedTables) {
    const entryOffset = fontInfo.tableEntryByTag.get(table.tag)
    if (entryOffset === undefined)
      continue

    // Check if this table was already written (TTC table sharing)
    const tKey = table.key
    const existing = writtenTables.get(tKey)
    if (existing) {
      // Reuse the existing table
      updateTableEntry(outView, entryOffset, existing.checksum, existing.dstOffset, existing.dstLength)
      if (isTTC) {
        // Add its checksum to font checksum
        fontChecksum = (fontChecksum + existing.checksum) >>> 0
        // Add checksum of the 12-byte table entry update
        fontChecksum = (fontChecksum + computeTableEntryChecksum(existing.checksum, existing.dstOffset, existing.dstLength)) >>> 0
      }
      continue
    }

    table.dstOffset = dstOffset

    let tableData: Uint8Array
    let checksum: number

    if ((table.flags & WOFF2_FLAGS_TRANSFORM) !== 0) {
      if (table.tag === TAG_GLYF && glyfTable && locaTable) {
        // Reconstruct glyf/loca
        const result = reconstructGlyf(
          decompressed,
          glyfTable,
          locaTable,
          fontInfo,
        )
        tableData = result.glyfData
        glyfTable.dstLength = result.glyfData.byteLength
        locaTable.dstOffset = dstOffset + pad4(result.glyfData.byteLength)
        locaTable.dstLength = result.locaData.byteLength

        // Write glyf
        output.set(tableData, dstOffset)
        checksum = computeChecksum(output, dstOffset, tableData.byteLength)
        updateTableEntry(outView, entryOffset, checksum, dstOffset, tableData.byteLength)
        if (isTTC) {
          fontChecksum = (fontChecksum + checksum) >>> 0
          fontChecksum = (fontChecksum + computeTableEntryChecksum(checksum, dstOffset, tableData.byteLength)) >>> 0
        }
        writtenTables.set(tKey, {
          dstOffset,
          dstLength: tableData.byteLength,
          checksum,
        })
        dstOffset += pad4(tableData.byteLength)

        // Write loca
        const locaEntryOffset = fontInfo.tableEntryByTag.get(TAG_LOCA)
        if (locaEntryOffset !== undefined) {
          output.set(result.locaData, dstOffset)
          const locaChecksum = computeChecksum(output, dstOffset, result.locaData.byteLength)
          updateTableEntry(outView, locaEntryOffset, locaChecksum, dstOffset, result.locaData.byteLength)
          if (isTTC) {
            fontChecksum = (fontChecksum + locaChecksum) >>> 0
            fontChecksum = (fontChecksum + computeTableEntryChecksum(locaChecksum, dstOffset, result.locaData.byteLength)) >>> 0
          }
          writtenTables.set(locaTable.key, {
            dstOffset,
            dstLength: result.locaData.byteLength,
            checksum: locaChecksum,
          })
          dstOffset += pad4(result.locaData.byteLength)
        }
        continue
      }
      else if (table.tag === TAG_LOCA) {
        // Already handled with glyf
        continue
      }
      else if (table.tag === TAG_HMTX) {
        // Reconstruct hmtx
        tableData = reconstructHmtx(
          decompressed,
          table,
          fontInfo.numGlyphs,
          fontInfo.numHMetrics,
          fontInfo.xMins,
        )
      }
      else {
        throw new Error(`Unknown transform for table ${tagToString(table.tag)}`)
      }
    }
    else {
      // No transform, copy directly
      tableData = decompressed.subarray(
        table.srcOffset,
        table.srcOffset + table.srcLength,
      )

      // Zero out checkSumAdjustment in head table
      if (table.tag === TAG_HEAD && tableData.byteLength >= 12) {
        tableData = new Uint8Array(tableData) // Copy to avoid modifying decompressed
        const headView = new DataView(tableData.buffer, tableData.byteOffset)
        headView.setUint32(8, 0)
      }
    }

    output.set(tableData, dstOffset)
    checksum = computeChecksum(output, dstOffset, tableData.byteLength)
    table.dstLength = tableData.byteLength

    updateTableEntry(outView, entryOffset, checksum, dstOffset, tableData.byteLength)
    if (isTTC) {
      fontChecksum = (fontChecksum + checksum) >>> 0
      fontChecksum = (fontChecksum + computeTableEntryChecksum(checksum, dstOffset, tableData.byteLength)) >>> 0
    }
    writtenTables.set(tKey, {
      dstOffset,
      dstLength: tableData.byteLength,
      checksum,
    })
    dstOffset += pad4(tableData.byteLength)
  }

  // Update head checkSumAdjustment
  const headTable = sortedTables.find(t => t.tag === TAG_HEAD)
  if (headTable) {
    const headEntry = writtenTables.get(headTable.key)
    if (headEntry && headEntry.dstLength >= 12) {
      // For single fonts, compute checksum over entire output
      // For TTC, use accumulated fontChecksum
      const finalChecksum = isTTC
        ? fontChecksum
        : computeChecksum(output, 0, dstOffset)
      outView.setUint32(headEntry.dstOffset + 8, (0xB1B0AFBA - finalChecksum) >>> 0)
    }
  }

  return dstOffset
}

function computeTableEntryChecksum(checksum: number, offset: number, length: number): number {
  return (checksum + offset + length) >>> 0
}

// Lightweight byte reader to avoid Buffer class overhead in hot paths
interface ByteStream {
  data: Uint8Array
  pos: number
  end: number
}

function makeByteStream(data: Uint8Array, start: number, length: number): ByteStream {
  return { data, pos: start, end: start + length }
}

function bsReadU8(stream: ByteStream): number {
  if (stream.pos >= stream.end)
    throw new Error('Stream overflow')
  return stream.data[stream.pos++]
}

function bsReadU16(stream: ByteStream): number {
  if (stream.pos + 2 > stream.end)
    throw new Error('Stream overflow')
  const idx = stream.pos
  stream.pos = idx + 2
  return (stream.data[idx] << 8) | stream.data[idx + 1]
}

function bsReadS16(stream: ByteStream): number {
  if (stream.pos + 2 > stream.end)
    throw new Error('Stream overflow')
  const idx = stream.pos
  stream.pos = idx + 2
  const val = (stream.data[idx] << 8) | stream.data[idx + 1]
  return (val & 0x8000) !== 0 ? val - 0x10000 : val
}

function fsReadU32(stream: ByteStream): number {
  if (stream.pos + 4 > stream.end)
    throw new Error('Stream overflow')
  const idx = stream.pos
  stream.pos = idx + 4
  return (
    (stream.data[idx] * 0x1000000
      + ((stream.data[idx + 1] << 16) | (stream.data[idx + 2] << 8) | stream.data[idx + 3]))
    >>> 0
  )
}

function bsSkip(stream: ByteStream, n: number): void {
  if (stream.pos + n > stream.end || n < 0)
    throw new Error('Stream overflow')
  stream.pos += n
}

function fsReadBytes(stream: ByteStream, n: number): Uint8Array {
  if (stream.pos + n > stream.end || n < 0)
    throw new Error('Stream overflow')
  const start = stream.pos
  stream.pos += n
  return stream.data.subarray(start, start + n)
}

function bsRead255UShort(stream: ByteStream): number {
  const code = bsReadU8(stream)
  if (code === 253) {
    return bsReadU16(stream)
  }
  else if (code === 255) {
    return 253 + bsReadU8(stream)
  }
  else if (code === 254) {
    return 253 * 2 + bsReadU8(stream)
  }
  return code
}

// WOFF2 transforms glyf/loca tables for better compression by separating
// glyph data into streams (contours, points, flags, coordinates, composites,
// bboxes, instructions) and using variable-length encodings. This function
// reconstructs the original TrueType glyf and loca tables from the streams
function reconstructGlyf(
  data: Uint8Array,
  glyfTable: Table,
  _locaTable: Table,
  fontInfo: FontInfo,
): { glyfData: Uint8Array, locaData: Uint8Array } {
  const headerStream = makeByteStream(
    data,
    glyfTable.srcOffset,
    glyfTable.transformLength,
  )

  // Read glyf header
  bsReadU16(headerStream) // version
  const optionFlags = bsReadU16(headerStream)
  const numGlyphs = bsReadU16(headerStream)
  const indexFormat = bsReadU16(headerStream)

  fontInfo.numGlyphs = numGlyphs
  fontInfo.indexFormat = indexFormat

  // Read substream sizes
  const nContourStreamSize = fsReadU32(headerStream)
  const nPointsStreamSize = fsReadU32(headerStream)
  const flagStreamSize = fsReadU32(headerStream)
  const glyphStreamSize = fsReadU32(headerStream)
  const compositeStreamSize = fsReadU32(headerStream)
  const bboxStreamSize = fsReadU32(headerStream)
  const instructionStreamSize = fsReadU32(headerStream)

  // Calculate substream offsets
  let offset = headerStream.pos
  const nContourStream = makeByteStream(data, offset, nContourStreamSize)
  offset += nContourStreamSize
  const nPointsStream = makeByteStream(data, offset, nPointsStreamSize)
  offset += nPointsStreamSize
  const flagStream = makeByteStream(data, offset, flagStreamSize)
  offset += flagStreamSize
  const glyphStream = makeByteStream(data, offset, glyphStreamSize)
  offset += glyphStreamSize
  const compositeStream = makeByteStream(data, offset, compositeStreamSize)
  offset += compositeStreamSize
  const bboxStream = makeByteStream(data, offset, bboxStreamSize)
  offset += bboxStreamSize
  const instructionStream = makeByteStream(data, offset, instructionStreamSize)

  // Overlap bitmap
  const hasOverlapBitmap = (optionFlags & 1) !== 0
  let overlapBitmap: Uint8Array | null = null
  if (hasOverlapBitmap) {
    const overlapBitmapLength = (numGlyphs + 7) >> 3
    overlapBitmap = data.subarray(
      offset + instructionStreamSize,
      offset + instructionStreamSize + overlapBitmapLength,
    )
  }

  // Read bbox bitmap
  const bboxBitmapLength = ((numGlyphs + 31) >> 5) << 2
  const bboxBitmap = fsReadBytes(bboxStream, bboxBitmapLength)

  // Estimate output size (will be resized if needed)
  let glyfOutput = new Uint8Array(glyfTable.origLength * 2)
  let glyfOffset = 0

  const locaValues = new Uint32Array(numGlyphs + 1)
  fontInfo.xMins = new Int16Array(numGlyphs)

  let contourEndsScratch = new Uint16Array(128)
  let flagsScratch = new Uint8Array(512)
  let xScratch = new Uint8Array(512)
  let yScratch = new Uint8Array(512)

  // Process each glyph
  for (let glyphId = 0; glyphId < numGlyphs; glyphId++) {
    locaValues[glyphId] = glyfOffset

    const nContours = bsReadS16(nContourStream)

    const haveBbox = (bboxBitmap[glyphId >> 3] & (0x80 >> (glyphId & 7))) !== 0

    if (nContours === 0) {
      // Empty glyph
      if (haveBbox) {
        throw new Error(`Empty glyph ${glyphId} has bbox`)
      }
      continue
    }

    if (nContours === -1) {
      // Composite glyph
      if (!haveBbox) {
        throw new Error(`Composite glyph ${glyphId} missing bbox`)
      }

      const { compositeData, haveInstructions } = readCompositeGlyph(compositeStream)

      let instructionSize = 0
      if (haveInstructions) {
        instructionSize = bsRead255UShort(glyphStream)
      }

      const glyphSize = 10 + compositeData.byteLength + (haveInstructions ? 2 + instructionSize : 0)
      ensureCapacity(glyphSize)

      // Write glyph header
      writeInt16BE(glyfOutput, glyfOffset, -1) // nContours

      // Write bbox
      const bbox = fsReadBytes(bboxStream, 8)
      glyfOutput.set(bbox, glyfOffset + 2)

      // Store xMin
      fontInfo.xMins[glyphId] = readInt16BE(bbox, 0)

      // Write composite data
      glyfOutput.set(compositeData, glyfOffset + 10)

      if (haveInstructions) {
        const instrOffset = glyfOffset + 10 + compositeData.byteLength
        writeUint16BE(glyfOutput, instrOffset, instructionSize)
        const instructions = fsReadBytes(instructionStream, instructionSize)
        glyfOutput.set(instructions, instrOffset + 2)
      }

      glyfOffset += glyphSize
      glyfOffset = pad4(glyfOffset)
    }
    else {
      // Simple glyph: write directly into output to avoid allocations
      if (nContours > contourEndsScratch.length) {
        contourEndsScratch = new Uint16Array(nContours * 2)
      }

      let totalPoints = 0
      let endPoint = -1
      for (let i = 0; i < nContours; i++) {
        const n = bsRead255UShort(nPointsStream)
        totalPoints += n
        endPoint += n
        contourEndsScratch[i] = endPoint
      }

      const scratchSize = totalPoints * 2
      if (scratchSize > flagsScratch.length) {
        flagsScratch = new Uint8Array(scratchSize)
      }
      if (scratchSize > xScratch.length) {
        xScratch = new Uint8Array(scratchSize)
      }
      if (scratchSize > yScratch.length) {
        yScratch = new Uint8Array(scratchSize)
      }

      const encoded = encodeTripletsToScratch(
        flagStream,
        glyphStream,
        totalPoints,
        ((overlapBitmap?.[glyphId >> 3] ?? 0) & (0x80 >> (glyphId & 7))) !== 0,
        flagsScratch,
        xScratch,
        yScratch,
      )

      const instructionSize = bsRead255UShort(glyphStream)
      const glyphSize
        = 10
          + 2 * nContours
          + 2
          + instructionSize
          + encoded.flagsLen
          + encoded.xLen
          + encoded.yLen

      ensureCapacity(glyphSize)

      // nContours
      writeInt16BE(glyfOutput, glyfOffset, nContours)

      // Bbox
      let xMin = 0
      if (haveBbox) {
        const bbox = fsReadBytes(bboxStream, 8)
        glyfOutput.set(bbox, glyfOffset + 2)
        xMin = readInt16BE(bbox, 0)
      }
      else {
        writeInt16BE(glyfOutput, glyfOffset + 2, encoded.xMin)
        writeInt16BE(glyfOutput, glyfOffset + 4, encoded.yMin)
        writeInt16BE(glyfOutput, glyfOffset + 6, encoded.xMax)
        writeInt16BE(glyfOutput, glyfOffset + 8, encoded.yMax)
        xMin = encoded.xMin
      }

      let writeOffset = glyfOffset + 10

      // End points of contours
      for (let i = 0; i < nContours; i++) {
        writeUint16BE(glyfOutput, writeOffset, contourEndsScratch[i])
        writeOffset += 2
      }

      // Instructions
      writeUint16BE(glyfOutput, writeOffset, instructionSize)
      writeOffset += 2
      if (instructionSize > 0) {
        const instructions = fsReadBytes(instructionStream, instructionSize)
        glyfOutput.set(instructions, writeOffset)
        writeOffset += instructionSize
      }

      // Flags and coordinates
      glyfOutput.set(flagsScratch.subarray(0, encoded.flagsLen), writeOffset)
      writeOffset += encoded.flagsLen
      glyfOutput.set(xScratch.subarray(0, encoded.xLen), writeOffset)
      writeOffset += encoded.xLen
      glyfOutput.set(yScratch.subarray(0, encoded.yLen), writeOffset)

      fontInfo.xMins[glyphId] = xMin
      glyfOffset += glyphSize
      glyfOffset = pad4(glyfOffset)
    }
  }

  // Final loca entry
  locaValues[numGlyphs] = glyfOffset

  // Build loca table
  const locaSize = indexFormat ? (numGlyphs + 1) * 4 : (numGlyphs + 1) * 2
  const locaData = new Uint8Array(locaSize)
  const locaView = new DataView(locaData.buffer)

  for (let i = 0; i <= numGlyphs; i++) {
    if (indexFormat) {
      locaView.setUint32(i * 4, locaValues[i])
    }
    else {
      locaView.setUint16(i * 2, locaValues[i] >> 1)
    }
  }

  return {
    glyfData: glyfOutput.subarray(0, glyfOffset),
    locaData,
  }

  function ensureCapacity(needed: number): void {
    if (glyfOffset + needed > glyfOutput.byteLength) {
      const newOutput = new Uint8Array((glyfOffset + needed) * 2)
      newOutput.set(glyfOutput)
      glyfOutput = newOutput
    }
  }
}

function readCompositeGlyph(stream: ByteStream): {
  compositeData: Uint8Array
  haveInstructions: boolean
} {
  const FLAG_ARG_1_AND_2_ARE_WORDS = 1 << 0
  const FLAG_WE_HAVE_A_SCALE = 1 << 3
  const FLAG_MORE_COMPONENTS = 1 << 5
  const FLAG_WE_HAVE_AN_X_AND_Y_SCALE = 1 << 6
  const FLAG_WE_HAVE_A_TWO_BY_TWO = 1 << 7
  const FLAG_WE_HAVE_INSTRUCTIONS = 1 << 8

  const startOffset = stream.pos
  let haveInstructions = false
  let flags = FLAG_MORE_COMPONENTS

  while (flags & FLAG_MORE_COMPONENTS) {
    flags = bsReadU16(stream)
    haveInstructions = haveInstructions || (flags & FLAG_WE_HAVE_INSTRUCTIONS) !== 0

    let argSize = 2 // glyph index
    if (flags & FLAG_ARG_1_AND_2_ARE_WORDS) {
      argSize += 4
    }
    else {
      argSize += 2
    }
    if (flags & FLAG_WE_HAVE_A_SCALE) {
      argSize += 2
    }
    else if (flags & FLAG_WE_HAVE_AN_X_AND_Y_SCALE) {
      argSize += 4
    }
    else if (flags & FLAG_WE_HAVE_A_TWO_BY_TWO) {
      argSize += 8
    }

    bsSkip(stream, argSize)
  }

  const compositeData = stream.data.subarray(startOffset, stream.pos)

  return { compositeData, haveInstructions }
}

interface EncodedTriplets {
  flagsLen: number
  xLen: number
  yLen: number
  xMin: number
  yMin: number
  xMax: number
  yMax: number
}

// WOFF2 encodes glyph points as "triplets" where a single flag byte determines
// how dx/dy deltas are packed (see WOFF2 spec table 2). Low 7 bits select the
// encoding format (0-9: dx=0, 10-19: dy=0, 20-83: 1-byte packed, etc), bit 7
// indicates on-curve. This decodes triplets and re-encodes to TrueType format
function encodeTripletsToScratch(
  flagStream: ByteStream,
  glyphStream: ByteStream,
  nPoints: number,
  hasOverlapBit: boolean,
  flagsOut: Uint8Array,
  xOut: Uint8Array,
  yOut: Uint8Array,
): EncodedTriplets {
  if (nPoints === 0) {
    return {
      flagsLen: 0,
      xLen: 0,
      yLen: 0,
      xMin: 0,
      yMin: 0,
      xMax: 0,
      yMax: 0,
    }
  }

  let flagsLen = 0
  let xLen = 0
  let yLen = 0

  let x = 0
  let y = 0
  let xMin = 0
  let yMin = 0
  let xMax = 0
  let yMax = 0

  let lastFlag = -1
  let repeatCount = 0

  const flagData = flagStream.data
  let flagPos = flagStream.pos
  const flagEnd = flagStream.end
  const glyphData = glyphStream.data
  let glyphPos = glyphStream.pos
  const glyphEnd = glyphStream.end

  for (let i = 0; i < nPoints; i++) {
    if (flagPos >= flagEnd)
      throw new Error('Stream overflow')
    const flag = flagData[flagPos++]

    const onCurve = (flag & 0x80) === 0
    const flagLow = flag & 0x7F

    let dx: number
    let dy: number

    if (flagLow < 10) {
      // dx = 0
      dx = 0
      if (glyphPos >= glyphEnd)
        throw new Error('Stream overflow')
      const b = glyphData[glyphPos++]
      dy = ((flagLow & 14) << 7) + b
      if ((flagLow & 1) === 0)
        dy = -dy
    }
    else if (flagLow < 20) {
      // dy = 0
      if (glyphPos >= glyphEnd)
        throw new Error('Stream overflow')
      const b = glyphData[glyphPos++]
      dx = (((flagLow - 10) & 14) << 7) + b
      if ((flagLow & 1) === 0)
        dx = -dx
      dy = 0
    }
    else if (flagLow < 84) {
      // 1 byte packed
      if (glyphPos >= glyphEnd)
        throw new Error('Stream overflow')
      const b = glyphData[glyphPos++]
      const b0 = flagLow - 20
      dx = 1 + (b0 & 0x30) + (b >> 4)
      dy = 1 + ((b0 & 0x0C) << 2) + (b & 0x0F)
      if ((flagLow & 1) === 0)
        dx = -dx
      if ((flagLow & 2) === 0)
        dy = -dy
    }
    else if (flagLow < 120) {
      // 2 bytes
      if (glyphPos + 1 >= glyphEnd)
        throw new Error('Stream overflow')
      const b0 = glyphData[glyphPos++]
      const b1 = glyphData[glyphPos++]
      const idx = flagLow - 84
      dx = 1 + (((idx / 12) | 0) << 8) + b0
      dy = 1 + (((idx % 12) >> 2) << 8) + b1
      if ((flagLow & 1) === 0)
        dx = -dx
      if ((flagLow & 2) === 0)
        dy = -dy
    }
    else if (flagLow < 124) {
      // 3 bytes
      if (glyphPos + 2 >= glyphEnd)
        throw new Error('Stream overflow')
      const b0 = glyphData[glyphPos++]
      const b1 = glyphData[glyphPos++]
      const b2 = glyphData[glyphPos++]
      dx = (b0 << 4) + (b1 >> 4)
      dy = ((b1 & 0x0F) << 8) + b2
      if ((flagLow & 1) === 0)
        dx = -dx
      if ((flagLow & 2) === 0)
        dy = -dy
    }
    else {
      // 4 bytes
      if (glyphPos + 3 >= glyphEnd)
        throw new Error('Stream overflow')
      const b0 = glyphData[glyphPos++]
      const b1 = glyphData[glyphPos++]
      const b2 = glyphData[glyphPos++]
      const b3 = glyphData[glyphPos++]
      dx = (b0 << 8) + b1
      dy = (b2 << 8) + b3
      if ((flagLow & 1) === 0)
        dx = -dx
      if ((flagLow & 2) === 0)
        dy = -dy
    }

    x += dx
    y += dy

    if (i === 0) {
      xMin = xMax = x
      yMin = yMax = y
    }
    else {
      if (x < xMin)
        xMin = x
      if (x > xMax)
        xMax = x
      if (y < yMin)
        yMin = y
      if (y > yMax)
        yMax = y
    }

    let outFlag = onCurve ? FLAG_ON_CURVE : 0
    if (hasOverlapBit && i === 0)
      outFlag |= FLAG_OVERLAP_SIMPLE

    if (dx === 0) {
      outFlag |= FLAG_X_SAME
    }
    else if (dx >= -255 && dx <= 255) {
      outFlag |= FLAG_X_SHORT
      if (dx > 0)
        outFlag |= FLAG_X_SAME
      xOut[xLen++] = dx > 0 ? dx : -dx
    }
    else {
      xOut[xLen++] = (dx >> 8) & 0xFF
      xOut[xLen++] = dx & 0xFF
    }

    if (dy === 0) {
      outFlag |= FLAG_Y_SAME
    }
    else if (dy >= -255 && dy <= 255) {
      outFlag |= FLAG_Y_SHORT
      if (dy > 0)
        outFlag |= FLAG_Y_SAME
      yOut[yLen++] = dy > 0 ? dy : -dy
    }
    else {
      yOut[yLen++] = (dy >> 8) & 0xFF
      yOut[yLen++] = dy & 0xFF
    }

    if (outFlag === lastFlag && repeatCount < 255) {
      flagsOut[flagsLen - 1] |= FLAG_REPEAT
      repeatCount++
    }
    else {
      if (repeatCount > 0) {
        flagsOut[flagsLen++] = repeatCount
        repeatCount = 0
      }
      flagsOut[flagsLen++] = outFlag
      lastFlag = outFlag
    }
  }

  if (repeatCount > 0) {
    flagsOut[flagsLen++] = repeatCount
  }

  flagStream.pos = flagPos
  glyphStream.pos = glyphPos

  return {
    flagsLen,
    xLen,
    yLen,
    xMin,
    yMin,
    xMax,
    yMax,
  }
}

function reconstructHmtx(
  data: Uint8Array,
  table: Table,
  numGlyphs: number,
  numHMetrics: number,
  xMins: Int16Array,
): Uint8Array {
  const hmtxStream = makeByteStream(data, table.srcOffset, table.srcLength)

  const hmtxFlags = bsReadU8(hmtxStream)

  const hasProportionalLsbs = (hmtxFlags & 1) === 0
  const hasMonospaceLsbs = (hmtxFlags & 2) === 0

  // Read advance widths
  const advanceWidths = new Uint16Array(numHMetrics)
  for (let i = 0; i < numHMetrics; i++) {
    advanceWidths[i] = bsReadU16(hmtxStream)
  }

  // Read LSBs
  const lsbs = new Int16Array(numGlyphs)

  for (let i = 0; i < numHMetrics; i++) {
    if (hasProportionalLsbs) {
      lsbs[i] = bsReadS16(hmtxStream)
    }
    else {
      lsbs[i] = xMins[i]
    }
  }

  for (let i = numHMetrics; i < numGlyphs; i++) {
    if (hasMonospaceLsbs) {
      lsbs[i] = bsReadS16(hmtxStream)
    }
    else {
      lsbs[i] = xMins[i]
    }
  }

  // Build output
  const outputSize = numHMetrics * 4 + (numGlyphs - numHMetrics) * 2
  const output = new Uint8Array(outputSize)
  let offset = 0

  for (let i = 0; i < numGlyphs; i++) {
    if (i < numHMetrics) {
      writeUint16BE(output, offset, advanceWidths[i])
      offset += 2
    }
    writeInt16BE(output, offset, lsbs[i])
    offset += 2
  }

  return output
}

function updateTableEntry(
  view: DataView,
  entryOffset: number,
  checksum: number,
  offset: number,
  length: number,
): void {
  view.setUint32(entryOffset + 4, checksum)
  view.setUint32(entryOffset + 8, offset)
  view.setUint32(entryOffset + 12, length)
}

function readInt16BE(data: Uint8Array, offset: number): number {
  const val = (data[offset] << 8) | data[offset + 1]
  return (val & 0x8000) !== 0 ? val - 0x10000 : val
}

function writeInt16BE(data: Uint8Array, offset: number, value: number): void {
  data[offset] = (value >> 8) & 0xFF
  data[offset + 1] = value & 0xFF
}

function writeUint16BE(data: Uint8Array, offset: number, value: number): void {
  data[offset] = (value >> 8) & 0xFF
  data[offset + 1] = value & 0xFF
}
