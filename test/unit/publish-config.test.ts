import { describe, expect, it } from 'vitest'
import { hasPublishMount, parsePublishConfig } from '../../src/runtime/shared/publish'

describe('publish configuration', () => {
  it('normalizes a public URL and storage mount without contacting storage', () => {
    expect(parsePublishConfig({ storage: '/og/public/', baseURL: 'https://IMAGES.example.com/og///' })).toEqual({
      _tag: 'Ok',
      value: { storage: 'og:public', baseURL: 'https://images.example.com/og' },
    })
  })

  it.each([
    undefined,
    {},
    { storage: '', baseURL: 'https://images.example.com' },
    { storage: '   ', baseURL: 'https://images.example.com' },
    { storage: '/', baseURL: 'https://images.example.com' },
    { storage: 'public', baseURL: '/images' },
    { storage: 'public', baseURL: 'ftp://images.example.com' },
    { storage: 'public', baseURL: 'https://images.example.com?' },
    { storage: 'public', baseURL: 'https://images.example.com#' },
    { storage: 'public', baseURL: 'https://images.example.com?token=secret' },
    { storage: 'public', baseURL: 'https://user:secret@images.example.com' },
  ])('rejects invalid config without exposing its values: %j', (config) => {
    const parsed = parsePublishConfig(config)
    expect(parsed._tag).toBe('Err')
    if (parsed._tag !== 'Err')
      throw new Error('Expected invalid publish config')
    expect(parsed.reason).not.toContain('secret')
  })

  it('accepts HTTP for a local public image server', () => {
    expect(parsePublishConfig({ storage: 'public', baseURL: 'http://localhost:3000/images' })._tag).toBe('Ok')
  })

  it('accepts encoded query characters within an object prefix', () => {
    expect(parsePublishConfig({ storage: 'public', baseURL: 'https://images.example.com/a%3Fb' })._tag).toBe('Ok')
  })

  it('matches normalized mounts and rejects root or unrelated mounts', () => {
    expect(hasPublishMount('og:public', { 'og/public': { driver: 's3' } })).toBe(true)
    expect(hasPublishMount('og:public', { '': { driver: 'memory' }, 'other': { driver: 's3' } })).toBe(false)
  })
})
