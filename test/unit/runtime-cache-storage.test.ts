import type { NitroConfig } from 'nitropack'
import { describe, expect, it } from 'vitest'
import { configureRuntimeCacheStorage, resolveRuntimeCacheDriver } from '../../src/build/runtime-cache'

type CacheConfig = NitroConfig & { kv?: NitroConfig['storage'] }

describe('runtime cache mounts', () => {
  it.each([2, 3] as const)('bounds the default cache on Nitro %s', (version) => {
    const nitro: CacheConfig = {}
    const storage = configureRuntimeCacheStorage({ runtimeCacheStorage: true }, nitro, version)

    expect(storage).toEqual({ driver: 'lru-cache', max: 0, maxSize: 64 * 1024 * 1024 })
    expect(version === 3 ? nitro.kv?.['cache/nuxt-og-image'] : nitro.storage?.['cache/nuxt-og-image']).toBe(storage)
    expect(version === 3 ? nitro.storage : nitro.kv).toBeUndefined()
  })

  it.each([2, 3] as const)('reuses the closest normalized mount on Nitro %s', (version) => {
    const ancestor = { driver: 'memory' }
    const imageCache = { driver: 'lru-cache', maxSize: 1024 }
    const mounts = { 'cache': ancestor, '/cache:nuxt-og-image/': imageCache }
    const nitro: CacheConfig = version === 3 ? { kv: mounts } : { storage: mounts }

    expect(configureRuntimeCacheStorage({ runtimeCacheStorage: true }, nitro, version)).toBe(imageCache)
    expect(mounts).toEqual({ 'cache': ancestor, '/cache:nuxt-og-image/': imageCache })
  })

  it('prefers Nitro 3 kv over a separate legacy storage option', () => {
    const configured = { driver: 'lru-cache', maxSize: 1024 }
    const nitro: CacheConfig = { kv: { cache: configured }, storage: { cache: { driver: 'memory' } } }

    expect(configureRuntimeCacheStorage({ runtimeCacheStorage: true }, nitro, 3)).toBe(configured)
  })

  it.each([2, 3] as const)('finds named ancestor mounts on Nitro %s', (version) => {
    const custom = { driver: 'memory' }
    const mounts = { custom }
    const nitro: CacheConfig = version === 3 ? { kv: mounts } : { storage: mounts }

    expect(configureRuntimeCacheStorage({ runtimeCacheStorage: '/custom:images/' }, nitro, version)).toBe(custom)
    expect(configureRuntimeCacheStorage({ runtimeCacheStorage: 'missing' }, nitro, version)).toBeUndefined()
  })

  it.each([2, 3] as const)('mounts an explicit driver on Nitro %s', (version) => {
    const nitro: CacheConfig = {}
    const driver = { driver: 'lru-cache', maxSize: 1024 }

    expect(configureRuntimeCacheStorage({ runtimeCacheStorage: driver }, nitro, version)).toBe(driver)
    expect(version === 3 ? nitro.kv?.['nuxt-og-image'] : nitro.storage?.['nuxt-og-image']).toBe(driver)
    expect(version === 3 ? nitro.storage : nitro.kv).toBeUndefined()
  })

  it.each([2, 3] as const)('leaves mounts untouched when caching is disabled on Nitro %s', (version) => {
    const nitro: CacheConfig = {}

    expect(configureRuntimeCacheStorage({ runtimeCacheStorage: false }, nitro, version)).toBeUndefined()
    expect(nitro).toEqual({})
  })

  it('preserves an application LRU alias for a configured kv mount', async () => {
    const nitro: CacheConfig = { kv: { cache: { driver: 'lru-cache', maxSize: 1024 } }, alias: { 'lru-cache': '/app/lru-cache.mjs' } }
    const storage = configureRuntimeCacheStorage({ runtimeCacheStorage: true }, nitro, 3)

    await resolveRuntimeCacheDriver(storage, nitro, import.meta.dirname)

    expect(nitro.alias?.['lru-cache']).toBe('/app/lru-cache.mjs')
  })
})
