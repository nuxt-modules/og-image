import { describe, expect, it } from 'vitest'
import { separateProps } from '../../src/runtime/shared'
import { hashOgImageOptions } from '../../src/runtime/shared/urlEncoding'

describe('cache key generation', () => {
  describe('hashOgImageOptions', () => {
    it('same options produce same hash', () => {
      const a = hashOgImageOptions({ width: 1200, height: 600, props: { title: 'Hello' } })
      const b = hashOgImageOptions({ width: 1200, height: 600, props: { title: 'Hello' } })
      expect(a).toBe(b)
    })

    it('different options produce different hash', () => {
      const a = hashOgImageOptions({ width: 1200, height: 600, props: { title: 'Hello' } })
      const b = hashOgImageOptions({ width: 1200, height: 600, props: { title: 'World' } })
      expect(a).not.toBe(b)
    })

    it('excludes _path from hash so same options cache across pages', () => {
      const a = hashOgImageOptions({ _path: '/page-a', width: 1200, props: { title: 'Same' } })
      const b = hashOgImageOptions({ _path: '/page-b', width: 1200, props: { title: 'Same' } })
      expect(a).toBe(b)
    })

    it('excludes _hash from hash', () => {
      const a = hashOgImageOptions({ _hash: 'abc', width: 1200 })
      const b = hashOgImageOptions({ _hash: 'xyz', width: 1200 })
      expect(a).toBe(b)
    })

    it('componentHash changes output', () => {
      const a = hashOgImageOptions({ width: 1200 }, 'hash-v1')
      const b = hashOgImageOptions({ width: 1200 }, 'hash-v2')
      expect(a).not.toBe(b)
    })

    it('version changes output', () => {
      const a = hashOgImageOptions({ width: 1200 }, undefined, '6.3.0')
      const b = hashOgImageOptions({ width: 1200 }, undefined, '6.4.0')
      expect(a).not.toBe(b)
    })
  })

  describe('separateProps', () => {
    it('separates known OG image options from component props', () => {
      const separated = separateProps({ width: 800, title: 'Hello', ref: 'twitter' })

      // width is a known OG image option, stays at top level
      expect(separated.width).toBe(800)
      // title and ref are not OG image options, become props
      expect(separated.props).toEqual({ title: 'Hello', ref: 'twitter' })
    })
  })
})
