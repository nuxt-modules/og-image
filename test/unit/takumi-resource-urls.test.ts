import { describe, expect, it } from 'vitest'
import { extractResourceUrls } from '../../src/runtime/server/og-image/bindings/takumi/resource-urls'

describe('takumi resource URL extraction', () => {
  it('extracts fetchable image sources and CSS urls', () => {
    expect(extractResourceUrls({
      type: 'container',
      style: {
        backgroundImage: 'url("/bg.png")',
        maskImage: 'url(https://example.com/mask.svg)',
      },
      preset: {
        background: 'center / cover no-repeat url(http://cdn.test/preset.webp)',
      },
      tw: 'bg-[url(https://example.com/tw.png)]',
      children: [
        { type: 'image', src: '/image.png' },
        { type: 'image', src: 'https://example.com/photo.jpg' },
      ],
    })).toEqual([
      '/bg.png',
      'https://example.com/mask.svg',
      'http://cdn.test/preset.webp',
      'https://example.com/tw.png',
      '/image.png',
      'https://example.com/photo.jpg',
    ])
  })

  it('ignores embedded and internal URLs', () => {
    expect(extractResourceUrls({
      type: 'container',
      style: {
        backgroundImage: 'url(data:image/png;base64,abc)',
        maskImage: 'url(#mask)',
      },
      children: [
        { type: 'image', src: 'data:image/svg+xml,<svg />' },
        { type: 'image', src: '<svg><path fill="url(#paint)" /></svg>' },
      ],
    })).toEqual([])
  })

  it('deduplicates repeated URLs', () => {
    expect(extractResourceUrls({
      type: 'container',
      style: {
        backgroundImage: 'url(/same.png)',
      },
      children: [
        { type: 'image', src: '/same.png' },
      ],
    })).toEqual(['/same.png'])
  })
})
