import { join } from 'node:path'
import { isCI } from 'std-env'
import { prefixStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import { resolveCacheDir } from './cacheDir'

/**
 * Creates a file-based cache store that persists in node_modules/.cache
 * This is useful for CI environments where you want to persist the cache between builds
 *
 * Options:
 * - key: The cache key/namespace to use
 * - base: Fallback if key is not provided
 * - forceEnable: Force enable persistent cache even outside CI
 * - rootDir: Optional root directory to use for finding node_modules
 * - storage: Optional storage instance to prefix
 */
export function createPersistentCacheDriver(options: {
  key?: string
  base?: string
  forceEnable?: boolean
  rootDir?: string
  storage?: any
}) {
  // Only use persistent cache by default in CI environments
  // Can be forced with forceEnable option
  if (!isCI && !options.forceEnable) {
    // Return regular storage if provided, or null
    return options.storage || null
  }

  // Find the cache directory
  const cacheDir = resolveCacheDir({
    packageName: 'nuxt-og-image',
    createIfMissing: true,
    rootDir: options.rootDir,
  })

  if (!cacheDir) {
    console.warn('[Nuxt OG Image] Could not resolve node_modules/.cache directory, falling back to memory cache')
    return options.storage || null
  }

  // Create a namespaced directory for this specific cache
  const storageBase = options.key || options.base || 'og-image-cache'
  const storagePath = join(cacheDir, storageBase)

  // Create file-system based driver
  const driver = fsDriver({ base: storagePath })

  // Create and return the storage
  if (options.storage) {
    return prefixStorage(options.storage, storageBase)
  }

  return {
    driver,
    base: storageBase,
    path: storagePath,
  }
}
