export interface ReadBuffer {
  readonly offset: number
  skip: (length: number) => boolean
  readU8: () => number | null
  readU16: () => number | null
  readU32: () => number | null
}

export function createReadBuffer(input: ArrayBuffer | Uint8Array): ReadBuffer {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input)
  let offset = 0

  return {
    get offset() {
      return offset
    },
    skip(length) {
      if (length < 0 || offset + length > data.byteLength)
        return false
      offset += length
      return true
    },
    readU8() {
      if (offset + 1 > data.byteLength)
        return null
      return data[offset++]!
    },
    readU16() {
      if (offset + 2 > data.byteLength)
        return null
      const value = (data[offset]! << 8) | data[offset + 1]!
      offset += 2
      return value
    },
    readU32() {
      if (offset + 4 > data.byteLength)
        return null
      const value = (
        data[offset]! * 0x1000000
        + ((data[offset + 1]! << 16) | (data[offset + 2]! << 8) | data[offset + 3]!)
      ) >>> 0
      offset += 4
      return value
    },
  }
}
