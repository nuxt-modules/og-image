import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateCacheKey, getCacheBase } from '../../src/runtime/server/util/cacheKey'

// Mock dependencies
vi.mock('h3', () => ({
  getQuery: vi.fn(() => ({})),
}))

vi.mock('#site-config/server/composables/useSiteConfig', () => ({
  useSiteConfig: vi.fn(() => ({ url: 'https://example.com' })),
}))

vi.mock('../../src/runtime/shared', () => ({
  useOgImageRuntimeConfig: vi.fn(() => ({
    version: '1.0.0',
    baseCacheKey: 'og-image-1.0.0',
  })),
}))

vi.mock('std-env', () => ({
  isCI: false,
}))

// Create a mock H3Event
function createMockEvent() {
  return {
    path: '/test-path',
    context: {},
  }
}

describe('cacheKey.ts', () => {
  const mockConfig = vi.mocked(require('../../src/runtime/shared').useOgImageRuntimeConfig)
  const mockGetQuery = vi.mocked(require('h3').getQuery)

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    // Default mock implementation
    mockConfig.mockReturnValue({
      version: '1.0.0',
      baseCacheKey: 'og-image-1.0.0',
    })
    mockGetQuery.mockReturnValue({})
  })

  describe('generateCacheKey', () => {
    it('should generate basic cache key with default settings', () => {
      const mockEvent = createMockEvent()
      const result = generateCacheKey(mockEvent, '/test-path')

      expect(result).toContain('test-path')
      expect(result).toContain(':')
    })

    it('should return index for root path', () => {
      const mockEvent = createMockEvent()
      const result = generateCacheKey(mockEvent, '/')

      expect(result.startsWith('index:')).toBeTruthy()
    })

    it('should include query parameters when cacheIgnoreQuery is false', () => {
      const mockEvent = createMockEvent()
      mockConfig.mockReturnValue({
        version: '1.0.0',
        baseCacheKey: 'og-image-1.0.0',
        cacheIgnoreQuery: false,
      })
      mockGetQuery.mockReturnValue({ foo: 'bar' })

      const resultWithQuery = generateCacheKey(mockEvent, '/test-path')

      // Reset query but keep other settings the same
      mockGetQuery.mockReturnValue({})
      const resultWithoutQuery = generateCacheKey(mockEvent, '/test-path')

      // With different query params, should get different keys
      expect(resultWithQuery).not.toEqual(resultWithoutQuery)
    })

    it('should ignore query parameters when cacheIgnoreQuery is true', () => {
      const mockEvent = createMockEvent()
      mockConfig.mockReturnValue({
        version: '1.0.0',
        baseCacheKey: 'og-image-1.0.0',
        cacheIgnoreQuery: true,
      })

      // First call with query params
      mockGetQuery.mockReturnValue({ foo: 'bar' })
      const resultWithQuery = generateCacheKey(mockEvent, '/test-path')

      // Second call without query params
      mockGetQuery.mockReturnValue({})
      const resultWithoutQuery = generateCacheKey(mockEvent, '/test-path')

      // With cacheIgnoreQuery true, should get same key regardless of query params
      expect(resultWithQuery).toEqual(resultWithoutQuery)
    })

    it('should use custom cacheKeyHandler if provided', () => {
      const mockEvent = createMockEvent()
      const customHandler = vi.fn().mockReturnValue('custom-key')

      mockConfig.mockReturnValue({
        version: '1.0.0',
        baseCacheKey: 'og-image-1.0.0',
        cacheKeyHandler: customHandler,
      })

      const result = generateCacheKey(mockEvent, '/test-path')

      expect(customHandler).toHaveBeenCalledWith('test-path', mockEvent)
      expect(result).toBe('custom-key')
    })
  })

  describe('getCacheBase', () => {
    it('should return the default baseCacheKey when no custom key is set', () => {
      const result = getCacheBase()
      expect(result).toBe('og-image-1.0.0')
    })

    it('should return custom key when set', () => {
      mockConfig.mockReturnValue({
        version: '1.0.0',
        baseCacheKey: 'og-image-1.0.0',
        key: 'custom-cache-key',
      })

      const result = getCacheBase()
      expect(result).toBe('custom-cache-key')
    })

    it('should return "/" if neither key nor baseCacheKey is available', () => {
      mockConfig.mockReturnValue({})

      const result = getCacheBase()
      expect(result).toBe('/')
    })
  })
})
