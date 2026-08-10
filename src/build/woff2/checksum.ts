export function computeChecksum(data: Uint8Array, offset: number, length: number): number {
  let sum = 0
  const end = offset + length
  const view = new DataView(data.buffer, data.byteOffset)
  const alignedEnd = offset + (length & ~3)

  for (let index = offset; index < alignedEnd; index += 4)
    sum = (sum + view.getUint32(index)) >>> 0

  if (end > alignedEnd) {
    let last = 0
    for (let index = alignedEnd; index < end; index++)
      last = (last << 8) | data[index]!
    last <<= (4 - (end - alignedEnd)) * 8
    sum = (sum + last) >>> 0
  }

  return sum
}

export function pad4(value: number): number {
  return (value + 3) & ~3
}
