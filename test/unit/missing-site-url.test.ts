import { describe, expect, it } from 'vitest'
import { getMissingSiteUrlWarning } from '../../src/build/prerender'

describe('getMissingSiteUrlWarning', () => {
  it('warns when images were prerendered without a site URL', () => {
    expect(getMissingSiteUrlWarning({ siteUrl: '', prerenderedImageCount: 2 })).toContain('site.url')
  })

  it('stays quiet with a site URL', () => {
    expect(getMissingSiteUrlWarning({ siteUrl: 'https://example.com', prerenderedImageCount: 2 })).toBeNull()
  })

  it('stays quiet when no image was prerendered', () => {
    expect(getMissingSiteUrlWarning({ siteUrl: undefined, prerenderedImageCount: 0 })).toBeNull()
  })
})
