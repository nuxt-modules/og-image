import { describe, expect, it } from 'vitest'
import { isStaticOgImagePrerenderIgnored } from '../../src/build/prerender'

describe('isStaticOgImagePrerenderIgnored', () => {
  it.each([
    ['/_og/s/'],
    ['/_og/s'],
    ['/_og/'],
    ['/_og'],
    ['/'],
  ])('matches string prefix %s', (pattern) => {
    expect(isStaticOgImagePrerenderIgnored([pattern])).toBe(true)
  })

  it.each([
    ['/_og/d/'],
    ['/_og/r/'],
    ['/_og/r.png'],
    ['/blog'],
    ['/api/'],
    [''],
  ])('ignores non-matching string %j', (pattern) => {
    expect(isStaticOgImagePrerenderIgnored([pattern])).toBe(false)
  })

  it('matches RegExp patterns without mutating global lastIndex', () => {
    const globalPattern = /\/_og\/s\//g
    expect(isStaticOgImagePrerenderIgnored([globalPattern])).toBe(true)
    expect(globalPattern.lastIndex).toBe(0)
    expect(isStaticOgImagePrerenderIgnored([globalPattern])).toBe(true)
    expect(isStaticOgImagePrerenderIgnored([/^\/_og\/d\//])).toBe(false)
  })

  it('matches predicate functions returning strictly true', () => {
    expect(isStaticOgImagePrerenderIgnored([(path: string) => path.startsWith('/_og/s/')])).toBe(true)
    expect(isStaticOgImagePrerenderIgnored([(path: string) => path.startsWith('/blog/')])).toBe(false)
    expect(isStaticOgImagePrerenderIgnored([(path: string) => path as unknown as boolean])).toBe(false)
  })

  it('matches when any entry in a mixed array ignores static OG images', () => {
    expect(isStaticOgImagePrerenderIgnored(['/admin', /^\/api\//, '/_og/s/'])).toBe(true)
  })

  it('matches static OG image paths prefixed with app.baseURL', () => {
    expect(isStaticOgImagePrerenderIgnored(['/docs/_og/s/'], '/docs/')).toBe(true)
    expect(isStaticOgImagePrerenderIgnored(['/_og/s/'], '/docs/')).toBe(true)
    expect(isStaticOgImagePrerenderIgnored(['/docs/_og/d/'], '/docs/')).toBe(false)
  })

  it.each([
    [undefined],
    [null],
    [[]],
    ['/_og/s/'],
    [123],
    [{}],
    [[null, undefined, 42]],
  ])('returns false for empty or invalid input %j', (input) => {
    expect(isStaticOgImagePrerenderIgnored(input)).toBe(false)
  })
})
