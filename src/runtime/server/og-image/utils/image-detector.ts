/**
 * Lightweight image dimension detection using magic bytes
 * Supports PNG, JPEG, GIF
 */

export function getImageDimensions(data: Uint8Array): { width?: number, height?: number } {
  // PNG: IHDR chunk at bytes 16-24 (big-endian)
  if (data[0] === 0x89 && data[1] === 0x50 && data.length >= 24) {
    const width = new DataView(data.buffer, data.byteOffset + 16).getUint32(0, false)
    const height = new DataView(data.buffer, data.byteOffset + 20).getUint32(0, false)
    return { width, height }
  }

  // JPEG: scan for SOF (Start of Frame) marker
  if (data[0] === 0xFF && data[1] === 0xD8) {
    let i = 2
    while (i < data.length - 8) {
      if (data[i] === 0xFF) {
        const marker = data[i + 1]
        if ((marker! >= 0xC0 && marker! <= 0xC3) || marker === 0xC9) {
          // SOF marker found, height at i+5, width at i+7 (big-endian)
          const height = (data[i + 5]! << 8) | data[i + 6]!
          const width = (data[i + 7]! << 8) | data[i + 8]!
          return { width, height }
        }
        const len = (data[i + 2]! << 8) | data[i + 3]!
        i += len + 2
      }
      else {
        i++
      }
    }
  }

  // GIF: dimensions at bytes 6-9 (little-endian)
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data.length >= 10) {
    const width = data[6]! | (data[7]! << 8)
    const height = data[8]! | (data[9]! << 8)
    return { width, height }
  }

  return {}
}
