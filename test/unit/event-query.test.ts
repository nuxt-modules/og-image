import type { H3Event } from 'h3'
import { describe, expect, it } from 'vitest'
import { getEventQuery } from '../../src/runtime/server/util/query'

describe('getEventQuery', () => {
  it('parses query parameters from a relative H3 event path', () => {
    const relativeUrl = '/_og/r/profile.png?title=Hello%20Nuxt&tag=one&tag=two'
    const event = {
      path: relativeUrl,
      req: { url: relativeUrl },
    } as unknown as H3Event

    expect(getEventQuery(event)).toEqual({
      title: 'Hello Nuxt',
      tag: ['one', 'two'],
    })
  })
})
