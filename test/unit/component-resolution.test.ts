import { describe, expect, it } from 'vitest'
import { getRegisteredBaseNames, getRendererFromFilename, matchesComponentName, parseComponentName, stripRendererSuffix } from '../../src/util'

describe('component resolution', () => {
  describe('matchesComponentName', () => {
    it('default matches OgImageDefaultSatori', () => {
      expect(matchesComponentName('OgImageDefaultSatori', 'Default')).toBe(true)
    })

    it('default does NOT match OgImageBlogDefaultSatori', () => {
      expect(matchesComponentName('OgImageBlogDefaultSatori', 'Default')).toBe(false)
    })

    it('banner matches OgImageBannerSatori', () => {
      expect(matchesComponentName('OgImageBannerSatori', 'Banner')).toBe(true)
    })

    it('banner does NOT match OgImageSiteBannerSatori', () => {
      expect(matchesComponentName('OgImageSiteBannerSatori', 'Banner')).toBe(false)
    })

    it('nuxtSeo matches NuxtSeoSatori', () => {
      expect(matchesComponentName('NuxtSeoSatori', 'NuxtSeo')).toBe(true)
    })

    it('blog matches OgImageBlogSatori', () => {
      expect(matchesComponentName('OgImageBlogSatori', 'Blog')).toBe(true)
    })

    it('ogImageDefault matches OgImageDefaultSatori', () => {
      expect(matchesComponentName('OgImageDefaultSatori', 'OgImageDefault')).toBe(true)
    })

    it('exact pascalName match', () => {
      expect(matchesComponentName('OgImageDefaultSatori', 'OgImageDefaultSatori')).toBe(true)
    })

    it('nuxtSeo matches OgImageCommunityNuxtSeoSatori (ejected community)', () => {
      expect(matchesComponentName('OgImageCommunityNuxtSeoSatori', 'NuxtSeo')).toBe(true)
    })

    it('nuxtSeo matches OgImageCommunityNuxtSeoTakumi (ejected community)', () => {
      expect(matchesComponentName('OgImageCommunityNuxtSeoTakumi', 'NuxtSeo')).toBe(true)
    })

    it('banner matches OgImageTemplateBannerSatori', () => {
      expect(matchesComponentName('OgImageTemplateBannerSatori', 'Banner')).toBe(true)
    })

    // Nuxt deduplicates when filename starts with the last word of the directory prefix.
    // e.g. OgImage/ImageTest.satori.vue → OgImageTestSatori (not OgImageImageTestSatori)
    it('imageTest matches OgImageTestSatori (Nuxt prefix deduplication)', () => {
      expect(matchesComponentName('OgImageTestSatori', 'ImageTest')).toBe(true)
    })

    it('imageTest does NOT match OgImageBlogTestSatori', () => {
      expect(matchesComponentName('OgImageBlogTestSatori', 'ImageTest')).toBe(false)
    })

    it('test still matches OgImageTestSatori (non-deduplicated interpretation)', () => {
      expect(matchesComponentName('OgImageTestSatori', 'Test')).toBe(true)
    })

    it('communityNuxtSeo matches OgImageCommunityNuxtSeoSatori (community dedup)', () => {
      expect(matchesComponentName('OgImageNuxtSeoSatori', 'CommunityNuxtSeo')).toBe(false)
    })
  })

  describe('getRegisteredBaseNames', () => {
    it('standard OgImage prefix', () => {
      expect(getRegisteredBaseNames('OgImageBannerSatori')).toEqual(['Banner', 'ImageBanner'])
    })

    it('dedup case: OgImage/ImageTest → OgImageTestSatori', () => {
      expect(getRegisteredBaseNames('OgImageTestSatori')).toEqual(['Test', 'ImageTest'])
    })

    it('community prefix', () => {
      expect(getRegisteredBaseNames('OgImageCommunityNuxtSeoSatori')).toEqual(['NuxtSeo', 'CommunityNuxtSeo'])
    })

    it('template prefix', () => {
      expect(getRegisteredBaseNames('OgImageTemplateBannerSatori')).toEqual(['Banner', 'TemplateBanner'])
    })

    it('no prefix (e.g. NuxtSeo)', () => {
      expect(getRegisteredBaseNames('NuxtSeoSatori')).toEqual(['NuxtSeo'])
    })

    it('full dedup: overlap word IS the name', () => {
      // OgImage/Image.satori.vue → OgImageSatori (Nuxt dedup removes entire overlap)
      expect(getRegisteredBaseNames('OgImageSatori')).toEqual(['Image'])
    })

    it('withoutPrefix equals overlap word — no duplicate dedup candidate', () => {
      // OgImage/ImageImage.satori.vue → OgImageImageSatori (dedup: OgImage + ImageImage → OgImageImage)
      // withoutPrefix = 'Image', which equals overlapWord, so no additional candidate
      expect(getRegisteredBaseNames('OgImageImageSatori')).toEqual(['Image'])
    })
  })

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
