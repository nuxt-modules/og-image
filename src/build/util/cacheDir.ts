import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Resolves path to the node_modules/.cache directory for storing OG image cache
 * This helps persist cache across CI deployments when node_modules is cached
 */
export function resolveCacheDir(options: { packageName?: string, createIfMissing?: boolean, rootDir?: string } = {}): string | null {
  const packageName = options.packageName || 'nuxt-og-image'
  const createIfMissing = options.createIfMissing ?? true

  // Use provided rootDir
  const startDir = options.rootDir || '.'

  // Try to find node_modules/.cache relative to the root directory
  try {
    // Start from root directory and look for node_modules
    let currentDir = startDir
    let nodeModulesDir: string | null = null

    // Look up to 5 levels up for node_modules
    for (let i = 0; i < 5; i++) {
      const potentialNodeModulesDir = join(currentDir, 'node_modules')
      if (existsSync(potentialNodeModulesDir)) {
        nodeModulesDir = potentialNodeModulesDir
        break
      }

      // Move up one directory
      const parentDir = resolve(currentDir, '..')
      if (parentDir === currentDir) {
        // We've reached the root directory
        break
      }
      currentDir = parentDir
    }

    if (!nodeModulesDir) {
      return null
    }

    // Resolve the .cache directory
    const cacheDir = join(nodeModulesDir, '.cache', packageName)

    // Create directory if it doesn't exist and createIfMissing is true
    if (createIfMissing && !existsSync(cacheDir)) {
      try {
        mkdirSync(cacheDir, { recursive: true })
      }
      catch (error) {
        console.warn(`[Nuxt OG Image] Failed to create cache directory: ${error.message}`)
        return null
      }
    }

    return cacheDir
  }
  catch (error) {
    console.warn(`[Nuxt OG Image] Error resolving cache directory: ${error.message}`)
    return null
  }
}
