import type { OgImageOptions } from '../../src/runtime/types'
import { describe, expect, it } from 'vitest'
import { generateMeta } from '../../src/runtime/shared'

describe('generateMeta', () => {
  const url = 'https://example.com/_og/s/abc.png'
  const options: OgImageOptions = { width: 1200, height: 600, alt: 'test', extension: 'png' }

  function tagNames(meta: ReturnType<typeof generateMeta>) {
    return meta.map(m => ('name' in m ? m.name : m.property))
  }

  it('emits twitter tags alongside og tags by default', () => {
    const names = tagNames(generateMeta(url, { ...options }))
    expect(names).toContain('twitter:card')
    expect(names).toContain('twitter:image')
    expect(names).toContain('og:image')
  })

  it('emits twitter tags when includeTwitter is true', () => {
    const names = tagNames(generateMeta(url, { ...options }, { includeTwitter: true }))
    expect(names).toContain('twitter:card')
    expect(names).toContain('og:image')
  })

  it('omits all twitter tags when includeTwitter is false while keeping og tags', () => {
    const meta = generateMeta(url, { ...options }, { includeTwitter: false })
    expect(tagNames(meta).filter(name => String(name).startsWith('twitter:'))).toEqual([])
    const names = tagNames(meta)
    expect(names).toContain('og:image')
    expect(names).toContain('og:image:type')
    expect(names).toContain('og:image:width')
    expect(names).toContain('og:image:height')
    expect(names).toContain('og:image:alt')
  })

  it('emits nothing for the twitter key when includeTwitter is false', () => {
    const meta = generateMeta(url, { ...options, key: 'twitter' }, { includeTwitter: false })
    expect(meta).toEqual([])
  })

  it('keeps twitter tags for the twitter key by default', () => {
    const meta = generateMeta(url, { ...options, key: 'twitter' })
    expect(tagNames(meta)).toContain('twitter:card')
    expect(tagNames(meta)).not.toContain('og:image')
  })
})
