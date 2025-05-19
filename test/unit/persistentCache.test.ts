import * as stdEnvModule from 'std-env'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveCacheDir } from '../../src/runtime/server/util/cacheDir'
import { createPersistentCacheDriver } from '../../src/runtime/server/util/persistentCache'

// Mock dependencies and imports
vi.mock('std-env', () => {
  return {
    isCI: false,
  }
})

vi.mock('../../src/runtime/server/util/cacheDir', () => ({
  resolveCacheDir: vi.fn().mockReturnValue('/mock/cache/dir'),
}))

vi.mock('unstorage', () => ({
  prefixStorage: vi.fn((storage, prefix) => ({ ...storage, prefix })),
}))

vi.mock('unstorage/drivers/fs', () => {
  return {
    default: vi.fn(options => ({ type: 'fs', options })),
  }
})

vi.mock('#imports', () => ({
  useStorage: vi.fn(() => ({ type: 'memory' })),
  useRuntimeConfig: vi.fn(() => ({ app: { rootDir: '/mock/root/dir' } })),
}))

describe('persistentCache.ts', () => {
  const mockResolveCacheDir = vi.mocked(resolveCacheDir)
  const mockUseStorage = vi.mocked(import('#imports')).useStorage
  // Get access to the mocked stdEnv module
  const stdEnv = vi.mocked(stdEnvModule)

  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveCacheDir.mockReturnValue('/mock/cache/dir')
    mockUseStorage.mockReturnValue({ type: 'memory' })
  })

  describe('createPersistentCacheDriver', () => {
    it('should use memory storage when not in CI environment', () => {
      // Set isCI to false for this test
      vi.mocked(stdEnvModule).isCI = false

      const result = createPersistentCacheDriver({ key: 'test-key' })

      expect(mockUseStorage).toHaveBeenCalled()
      expect(result.type).toBe('memory')
      expect(mockResolveCacheDir).not.toHaveBeenCalled()
    })

    it('should use persistent storage when in CI environment', () => {
      // Set isCI to true for this test
      vi.mocked(stdEnvModule).isCI = true

      const result = createPersistentCacheDriver({ key: 'test-key' })

      expect(mockResolveCacheDir).toHaveBeenCalledWith(expect.objectContaining({
        packageName: 'nuxt-og-image',
        createIfMissing: true,
      }))
      expect(result.prefix).toBe('test-key')
    })

    it('should use persistent storage when forceEnable is true, even outside CI', () => {
      vi.mocked(stdEnvModule).isCI = false

      const result = createPersistentCacheDriver({
        key: 'test-key',
        forceEnable: true,
      })

      expect(mockResolveCacheDir).toHaveBeenCalled()
      expect(result.prefix).toBe('test-key')
    })

    it('should fall back to memory storage if cache directory resolution fails', () => {
      vi.mocked(stdEnvModule).isCI = true
      mockResolveCacheDir.mockReturnValue(null)

      const result = createPersistentCacheDriver({ key: 'test-key' })

      expect(result.type).toBe('memory')
    })

    it('should use provided key for storage prefix', () => {
      vi.mocked(stdEnvModule).isCI = true

      const result = createPersistentCacheDriver({ key: 'custom-key' })

      expect(result.prefix).toBe('custom-key')
    })

    it('should use provided base if key is not specified', () => {
      vi.mocked(stdEnvModule).isCI = true

      const result = createPersistentCacheDriver({ base: 'fallback-base' })

      expect(result.prefix).toBe('fallback-base')
    })

    it('should use default og-image-cache if neither key nor base is provided', () => {
      vi.mocked(stdEnvModule).isCI = true

      const result = createPersistentCacheDriver({})

      expect(result.prefix).toBe('og-image-cache')
    })
  })
})
