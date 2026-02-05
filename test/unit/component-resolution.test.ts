import { describe, expect, it } from 'vitest'
import { getRendererFromFilename, parseComponentName, stripRendererSuffix } from '../../src/util'

describe('component resolution', () => {
  describe('parseComponentName', () => {
    it('parses dot notation', () => {
      expect(parseComponentName('Banner.satori')).toEqual({ baseName: 'Banner', renderer: 'satori' })
      expect(parseComponentName('NuxtSeo.takumi')).toEqual({ baseName: 'NuxtSeo', renderer: 'takumi' })
      expect(parseComponentName('MyComponent.browser')).toEqual({ baseName: 'MyComponent', renderer: 'browser' })
    })

    it('parses PascalCase suffix', () => {
      expect(parseComponentName('BannerSatori')).toEqual({ baseName: 'Banner', renderer: 'satori' })
      expect(parseComponentName('NuxtSeoTakumi')).toEqual({ baseName: 'NuxtSeo', renderer: 'takumi' })
      expect(parseComponentName('MyComponentBrowser')).toEqual({ baseName: 'MyComponent', renderer: 'browser' })
    })

    it('parses bare name (no renderer)', () => {
      expect(parseComponentName('Banner')).toEqual({ baseName: 'Banner', renderer: null })
      expect(parseComponentName('NuxtSeo')).toEqual({ baseName: 'NuxtSeo', renderer: null })
    })

    it('does not false-match partial suffix', () => {
      // 'Browser' at end but 'MyBrowser' is a name not a suffix
      expect(parseComponentName('MyBrowser')).toEqual({ baseName: 'My', renderer: 'browser' })
    })

    it('handles empty-ish names', () => {
      expect(parseComponentName('')).toEqual({ baseName: '', renderer: null })
    })
  })

  describe('stripRendererSuffix', () => {
    it('strips dot notation suffix', () => {
      expect(stripRendererSuffix('Banner.satori')).toBe('Banner')
      expect(stripRendererSuffix('NuxtSeo.takumi')).toBe('NuxtSeo')
    })

    it('strips PascalCase suffix', () => {
      expect(stripRendererSuffix('BannerSatori')).toBe('Banner')
      expect(stripRendererSuffix('NuxtSeoBrowser')).toBe('NuxtSeo')
    })

    it('returns name unchanged when no suffix', () => {
      expect(stripRendererSuffix('Banner')).toBe('Banner')
      expect(stripRendererSuffix('NuxtSeo')).toBe('NuxtSeo')
    })
  })

  describe('getRendererFromFilename', () => {
    it('extracts renderer from .satori.vue', () => {
      expect(getRendererFromFilename('components/OgImage/Banner.satori.vue')).toBe('satori')
    })

    it('extracts renderer from .takumi.vue', () => {
      expect(getRendererFromFilename('components/OgImage/NuxtSeo.takumi.vue')).toBe('takumi')
    })

    it('extracts renderer from .browser.vue', () => {
      expect(getRendererFromFilename('MyComponent.browser.vue')).toBe('browser')
    })

    it('returns null for no suffix', () => {
      expect(getRendererFromFilename('Banner.vue')).toBeNull()
    })

    it('returns null for invalid suffix', () => {
      expect(getRendererFromFilename('Banner.unknown.vue')).toBeNull()
    })
  })
})
