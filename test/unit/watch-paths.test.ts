import { describe, expect, it } from 'vitest'
import { isOgImageComponentPath, isPathWithinDir, isSamePath, resolveWatchedPath } from '../../src/build/watch-paths'

describe('builder:watch path resolution', () => {
  describe('resolveWatchedPath', () => {
    it('resolves Nuxt 4 srcDir-relative paths when adding a file', () => {
      const resolved = resolveWatchedPath('components/OgImage/Default.vue', {
        rootDir: '/project',
        srcDir: '/project/app',
        exists: p => p === '/project/app/components/OgImage/Default.vue',
        caseInsensitive: false,
      })
      expect(resolved).toBe('/project/app/components/OgImage/Default.vue')
    })

    it('resolves Nuxt 4 srcDir-relative paths when unlinking a deleted file', () => {
      const resolved = resolveWatchedPath('components/OgImage/Default.vue', {
        rootDir: '/project',
        srcDir: '/project/app',
        exists: () => false,
        caseInsensitive: false,
      })
      expect(resolved).toBe('/project/app/components/OgImage/Default.vue')
    })

    it('preserves rootDir-relative paths under srcDir when unlinking', () => {
      const resolved = resolveWatchedPath('app/components/OgImage/Default.vue', {
        rootDir: '/project',
        srcDir: '/project/app',
        exists: () => false,
        caseInsensitive: false,
      })
      expect(resolved).toBe('/project/app/components/OgImage/Default.vue')
    })

    it('resolves rootDir-relative files that exist outside srcDir', () => {
      const resolved = resolveWatchedPath('assets/css/main.css', {
        rootDir: '/project',
        srcDir: '/project/app',
        exists: p => p === '/project/assets/css/main.css',
        caseInsensitive: false,
      })
      expect(resolved).toBe('/project/assets/css/main.css')
    })

    it('normalizes Windows absolute paths', () => {
      const resolved = resolveWatchedPath('c:\\Users\\dev\\project\\app\\components\\OgImage\\Default.vue', {
        rootDir: 'C:/Users/dev/project',
        srcDir: 'C:/Users/dev/project/app',
        exists: () => true,
        caseInsensitive: true,
      })
      expect(resolved).toBe('C:/Users/dev/project/app/components/OgImage/Default.vue')
    })
  })

  describe('isSamePath', () => {
    it('matches normalized Windows paths regardless of slash direction and casing', () => {
      expect(isSamePath(
        'c:\\Users\\dev\\project\\app\\components\\OgImage\\Card.satori.vue',
        'C:/Users/dev/project/app/components/ogimage/Card.satori.vue',
        true,
      )).toBe(true)
    })

    it('respects case sensitivity on POSIX filesystems', () => {
      expect(isSamePath(
        '/project/app/components/OgImage/Card.satori.vue',
        '/project/app/components/ogimage/Card.satori.vue',
        false,
      )).toBe(false)
    })
  })

  describe('isOgImageComponentPath', () => {
    it('matches OG image components in Nuxt 4 srcDir', () => {
      expect(isOgImageComponentPath(
        '/project/app/components/OgImage/Default.vue',
        '/project/app',
        ['OgImage', 'OgImageTemplate'],
        false,
      )).toBe(true)
    })

    it('does not match sibling directories sharing a prefix', () => {
      expect(isOgImageComponentPath(
        '/project/app/components/OgImageExtra/Card.vue',
        '/project/app',
        ['OgImage'],
        false,
      )).toBe(false)
    })

    it('matches Windows paths regardless of drive letter or directory casing', () => {
      expect(isOgImageComponentPath(
        'c:/Users/dev/project/app/components/ogimage/Default.vue',
        'C:/Users/dev/project/app',
        ['OgImage'],
        true,
      )).toBe(true)
    })

    it('respects case sensitivity on POSIX filesystems', () => {
      expect(isPathWithinDir(
        '/project/app/components/ogimage/Default.vue',
        '/project/app/components/OgImage',
        false,
      )).toBe(false)
    })
  })
})
