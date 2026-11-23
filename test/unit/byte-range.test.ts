import { describe, expect, it } from 'vitest'
import { parseByteRange } from '../../src/runtime/server/util/byteRange'

describe('parseByteRange', () => {
  it.each([
    ['no header', undefined, { _tag: 'Full' }],
    ['a bounded range', 'bytes=0-1', { _tag: 'Partial', start: 0, end: 1 }],
    ['an open-ended range', 'bytes=90-', { _tag: 'Partial', start: 90, end: 99 }],
    ['a suffix range', 'bytes=-10', { _tag: 'Partial', start: 90, end: 99 }],
    ['a suffix longer than the body', 'bytes=-500', { _tag: 'Partial', start: 0, end: 99 }],
    ['an end past the body', 'bytes=50-500', { _tag: 'Partial', start: 50, end: 99 }],
    ['a start past the body', 'bytes=100-', { _tag: 'Unsatisfiable' }],
    ['an empty suffix', 'bytes=-0', { _tag: 'Unsatisfiable' }],
    ['several ranges', 'bytes=0-1,5-6', { _tag: 'Full' }],
    ['another unit', 'items=0-1', { _tag: 'Full' }],
    ['a reversed range', 'bytes=9-2', { _tag: 'Full' }],
    ['malformed numbers', 'bytes=a-b', { _tag: 'Full' }],
  ])('reads %s', (_, header, expected) => {
    expect(parseByteRange(header, 100)).toEqual(expected)
  })
})
