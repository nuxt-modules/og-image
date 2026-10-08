import type { NitroConfig } from 'nitropack'
import type { ModuleOptions } from '../module'

const DEFAULT_CACHE_MOUNT = 'cache/nuxt-og-image'
type StorageMount = NonNullable<NitroConfig['storage']>[string]

function findStorageMount(nitro: NitroConfig, prefix: string): StorageMount | undefined {
  return Object.entries(nitro.storage || {})
    .map(([key, storage]) => ({ mount: key.replaceAll(':', '/').replace(/^\/+|\/+$/g, ''), storage }))
    .filter(({ mount }) => prefix === mount || prefix.startsWith(`${mount}/`))
    .sort((a, b) => b.mount.length - a.mount.length)[0]
    ?.storage
}

/** Keep the default image cache bounded without changing other Nitro caches. */
export function configureRuntimeCacheStorage(config: Pick<ModuleOptions, 'runtimeCacheStorage'>, nitro: NitroConfig): StorageMount | undefined {
  if (typeof config.runtimeCacheStorage === 'object')
    return config.runtimeCacheStorage
  if (typeof config.runtimeCacheStorage === 'string')
    return findStorageMount(nitro, `${config.runtimeCacheStorage.replaceAll(':', '/').replace(/^\/+|\/+$/g, '')}/nuxt-og-image`)
  if (config.runtimeCacheStorage !== true)
    return

  // A configured ancestor or image mount takes precedence over the fallback.
  const configuredStorage = findStorageMount(nitro, DEFAULT_CACHE_MOUNT)
  if (configuredStorage)
    return configuredStorage

  nitro.storage ||= {}
  nitro.storage[DEFAULT_CACHE_MOUNT] = {
    driver: 'lru-cache',
    max: 0,
    maxSize: 64 * 1024 * 1024,
  }
  return nitro.storage[DEFAULT_CACHE_MOUNT]
}
