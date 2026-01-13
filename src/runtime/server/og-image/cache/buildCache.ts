import type { OgImageComponent } from '../../../types'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { componentNames } from '#og-image-virtual/component-names.mjs'
import { join } from 'pathe'
import { hashOgImageOptions } from '../../../shared/urlEncoding'
import { useOgImageRuntimeConfig } from '../../utils'

interface CachedImage {
  data: string // base64
  expiresAt: number
  createdAt: number
}

/**
 * Get the component hash for a given component name
 */
export function getComponentHash(componentName: string): string {
  const components = componentNames as OgImageComponent[]
  const component = components.find(
    c => c.pascalName === componentName || c.kebabName === componentName,
  )
  return component?.hash || ''
}

/**
 * Generate a cache key that includes options, component hash, and version
 */
export function generateBuildCacheKey(
  options: Record<string, any>,
  extension: string,
): string {
  const { version } = useOgImageRuntimeConfig()
  const componentHash = getComponentHash(options.component || 'NuxtSeo')
  const hash = hashOgImageOptions(options, componentHash, version)
  return `${hash}.${extension}`
}

/**
 * Check if an image exists in the build cache
 */
export function getBuildCachedImage(
  options: Record<string, any>,
  extension: string,
): Buffer | null {
  const { buildCacheDir } = useOgImageRuntimeConfig()
  if (!buildCacheDir)
    return null

  const cacheKey = generateBuildCacheKey(options, extension)
  const cachePath = join(buildCacheDir, cacheKey)

  if (!existsSync(cachePath))
    return null

  const cached: CachedImage = JSON.parse(readFileSync(cachePath, 'utf-8'))

  // Check expiry
  if (cached.expiresAt && cached.expiresAt < Date.now()) {
    return null
  }

  return Buffer.from(cached.data, 'base64')
}

/**
 * Save an image to the build cache
 */
export function setBuildCachedImage(
  options: Record<string, any>,
  extension: string,
  data: Buffer | Uint8Array,
  maxAgeSeconds: number,
): void {
  const { buildCacheDir } = useOgImageRuntimeConfig()
  if (!buildCacheDir)
    return

  const cacheKey = generateBuildCacheKey(options, extension)
  const cachePath = join(buildCacheDir, cacheKey)

  // Ensure cache directory exists
  if (!existsSync(buildCacheDir)) {
    mkdirSync(buildCacheDir, { recursive: true })
  }

  const cached: CachedImage = {
    data: Buffer.from(data).toString('base64'),
    expiresAt: Date.now() + (maxAgeSeconds * 1000),
    createdAt: Date.now(),
  }

  writeFileSync(cachePath, JSON.stringify(cached))
}
