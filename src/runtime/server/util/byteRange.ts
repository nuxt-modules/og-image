export type ByteRange
  = | { _tag: 'Full' }
    | { _tag: 'Partial', start: number, end: number }
    | { _tag: 'Unsatisfiable' }

const RE_SINGLE_BYTE_RANGE = /^bytes=(\d*)-(\d*)$/

/**
 * Read a `Range` request header for a body of `size` bytes. Video players such as Safari's
 * fetch an MP4 in byte ranges. A header this server does not serve, such as several ranges,
 * gets the full body, which RFC 9110 allows.
 */
export function parseByteRange(header: string | undefined, size: number): ByteRange {
  const match = header?.trim().match(RE_SINGLE_BYTE_RANGE)
  if (!match || (!match[1] && !match[2]))
    return { _tag: 'Full' }
  // `bytes=-N` asks for the last N bytes.
  if (!match[1]) {
    const suffix = Number(match[2])
    if (suffix === 0)
      return { _tag: 'Unsatisfiable' }
    return { _tag: 'Partial', start: Math.max(0, size - suffix), end: size - 1 }
  }
  const start = Number(match[1])
  if (start >= size)
    return { _tag: 'Unsatisfiable' }
  const end = match[2] ? Number(match[2]) : size - 1
  if (end < start)
    return { _tag: 'Full' }
  return { _tag: 'Partial', start, end: Math.min(end, size - 1) }
}
