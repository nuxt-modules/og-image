import { describe, expect, it } from 'vitest'
import { decodeOgImageParams, extractEncodedSegment } from '../../src/runtime/shared/urlEncoding'

describe('extractEncodedSegment', () => {
  describe('normal encoded URLs (single segment)', () => {
    it('extracts from /_og/d/ path', () => {
      expect(extractEncodedSegment('/_og/d/w_1200,title_Hello.png', 'png'))
        .toBe('w_1200,title_Hello')
    })

    it('extracts from /_og/s/ path', () => {
      expect(extractEncodedSegment('/_og/s/w_1200,title_Hello.png', 'png'))
        .toBe('w_1200,title_Hello')
    })

    it('strips jpeg extension', () => {
      expect(extractEncodedSegment('/_og/d/w_1200.jpeg', 'jpeg'))
        .toBe('w_1200')
    })

    it('handles hash mode segment', () => {
      expect(extractEncodedSegment('/_og/d/o_abc123.png', 'png'))
        .toBe('o_abc123')
    })

    it('handles default segment', () => {
      expect(extractEncodedSegment('/_og/d/default.png', 'png'))
        .toBe('default')
    })
  })

  describe('decoded %2F in prop values (#522)', () => {
    it('preserves full segment when coverSrc contains decoded slashes', () => {
      const path = '/_og/d/c_Blog,coverSrc_/img/blog/cover.jpg.png'
      expect(extractEncodedSegment(path, 'png'))
        .toBe('c_Blog,coverSrc_/img/blog/cover.jpg')
    })

    it('preserves full segment with multiple decoded slashes', () => {
      const path = '/_og/d/c_Blog,coverSrc_/img/foo/bar/baz.jpg,title_Hello.png'
      expect(extractEncodedSegment(path, 'png'))
        .toBe('c_Blog,coverSrc_/img/foo/bar/baz.jpg,title_Hello')
    })

    it('preserves full segment with single decoded slash', () => {
      const path = '/_og/d/c_Blog,coverSrc_/cover.jpg.png'
      expect(extractEncodedSegment(path, 'png'))
        .toBe('c_Blog,coverSrc_/cover.jpg')
    })

    it('works end-to-end: decoded slashes produce same params as encoded', () => {
      // Original encoded URL segment (before %2F decode)
      const originalSegment = 'c_Blog,coverSrc_%2Fimg%2Fblog%2Fcover.jpg,title_Hello+World'
      const originalDecoded = decodeOgImageParams(originalSegment)

      // After intermediary decodes %2F to /
      const decodedPath = '/_og/d/c_Blog,coverSrc_/img/blog/cover.jpg,title_Hello+World.png'
      const extractedSegment = extractEncodedSegment(decodedPath, 'png')
      const reDecoded = decodeOgImageParams(extractedSegment)

      expect(reDecoded).toEqual(originalDecoded)
      expect(reDecoded.component).toBe('Blog')
      expect(reDecoded.props?.coverSrc).toBe('/img/blog/cover.jpg')
      expect(reDecoded.props?.title).toBe('Hello World')
    })

    it('old behavior would fail: split("/").pop() loses props before decoded slash', () => {
      // Demonstrate what the old code would produce
      const path = '/_og/d/c_Blog,coverSrc_/img/blog/cover.jpg,title_Hello.png'
      const oldResult = (path.split('/').pop() as string).replace(/\.png$/, '')
      // Old: only gets the last segment after the last /
      expect(oldResult).toBe('cover.jpg,title_Hello')

      // New: gets the full segment
      const newResult = extractEncodedSegment(path, 'png')
      expect(newResult).toBe('c_Blog,coverSrc_/img/blog/cover.jpg,title_Hello')

      // Old decode loses component and coverSrc
      const oldDecoded = decodeOgImageParams(oldResult)
      expect(oldDecoded.component).toBeUndefined()

      // New decode preserves everything
      const newDecoded = decodeOgImageParams(newResult)
      expect(newDecoded.component).toBe('Blog')
      expect(newDecoded.props?.coverSrc).toBe('/img/blog/cover.jpg')
    })
  })

  describe('with base path prefix', () => {
    it('works when app has a base path', () => {
      expect(extractEncodedSegment('/prefix/_og/d/w_1200,title_Hello.png', 'png'))
        .toBe('w_1200,title_Hello')
    })

    it('works with base path and decoded slashes', () => {
      const path = '/my-app/_og/d/c_Blog,coverSrc_/img/cover.jpg.png'
      expect(extractEncodedSegment(path, 'png'))
        .toBe('c_Blog,coverSrc_/img/cover.jpg')
    })
  })

  describe('fallback behavior', () => {
    it('falls back to last segment when no /_og/ prefix found', () => {
      expect(extractEncodedSegment('/unknown/path/w_1200.png', 'png'))
        .toBe('w_1200')
    })
  })
})
