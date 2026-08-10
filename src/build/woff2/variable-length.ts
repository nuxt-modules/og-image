import type { ReadBuffer } from './read-buffer'

export function read255UShort(buffer: ReadBuffer): number | null {
  const code = buffer.readU8()
  if (code === null)
    return null
  if (code === 253)
    return buffer.readU16()
  if (code === 255) {
    const next = buffer.readU8()
    return next === null ? null : 253 + next
  }
  if (code === 254) {
    const next = buffer.readU8()
    return next === null ? null : 506 + next
  }
  return code
}

export function readBase128(buffer: ReadBuffer): number | null {
  let result = 0

  for (let index = 0; index < 5; index++) {
    const code = buffer.readU8()
    if (code === null || (index === 0 && code === 0x80) || (result & 0xFE000000) !== 0)
      return null
    result = (result << 7) | (code & 0x7F)
    if ((code & 0x80) === 0)
      return result
  }

  return null
}
