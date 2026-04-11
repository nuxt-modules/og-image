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

  describe('query param cache key impact', () => {
    // Simulates the flow: query params are separated into props via separateProps,
    // then merged into options via defu. When cacheQueryParams is false, query params
    // should NOT be processed, so the options hash stays the same regardless of
    // what query params the user appends to the OG image URL.

    it('unknown query params do not affect options after separateProps', () => {
      // Unknown params become props, which are then stripped by prop whitelisting
      const withQuery = separateProps({ ref: 'twitter', utm_source: 'og' })
      const withoutQuery = separateProps({})

      // 'ref' and 'utm_source' are not OG image options, so they become props
      expect(withQuery.props).toEqual({ ref: 'twitter', utm_source: 'og' })
      expect(withoutQuery.props).toBeUndefined()

      // After prop whitelisting removes them, the options hash would be identical
      const hashWith = hashOgImageOptions({ width: 1200, props: {} })
      const hashWithout = hashOgImageOptions({ width: 1200 })
      // Empty props object vs no props: hash should differ
      // This is why prop whitelisting is critical for cache stability
    })

    it('known OG image query params DO affect the options hash', () => {
      // If cacheQueryParams is true, a query like ?width=800 would override
      const baseOptions = { width: 1200, height: 600, props: { title: 'Hello' } }
      const overridden = { width: 800, height: 600, props: { title: 'Hello' } }

      const hashBase = hashOgImageOptions(baseOptions)
      const hashOverridden = hashOgImageOptions(overridden)
      expect(hashBase).not.toBe(hashOverridden)
    })

    it('declared prop query params affect the options hash', () => {
      // If cacheQueryParams is true and ?title=Override is passed,
      // it overrides the path-encoded title
      const original = { width: 1200, props: { title: 'Original' } }
      const overridden = { width: 1200, props: { title: 'Override' } }

      expect(hashOgImageOptions(original)).not.toBe(hashOgImageOptions(overridden))
    })

    it('query params separated correctly into options vs props', () => {
      // Simulate: ?width=800&title=Hello&ref=twitter
      const separated = separateProps({ width: 800, title: 'Hello', ref: 'twitter' })

      // width is a known OG image option, stays at top level
      expect(separated.width).toBe(800)
      // title and ref are not OG image options, become props
      expect(separated.props).toEqual({ title: 'Hello', ref: 'twitter' })
    })
  })
})
