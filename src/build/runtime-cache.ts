import type { NitroConfig } from 'nitropack'
import type { ModuleOptions } from '../module'
import { directoryToURL, tryResolveModule } from '@nuxt/kit'

const DEFAULT_CACHE_MOUNT = 'cache/nuxt-og-image'
type StorageMount = NonNullable<NitroConfig['storage']>[string]
type CacheNitroConfig = NitroConfig & { kv?: NitroConfig['storage'] }

/** Nitro 3 resolves optional driver libraries from the app rather than this module. */
export async function resolveRuntimeCacheDriver(storage: StorageMount | undefined, nitro: NitroConfig, rootDir: string): Promise<void> {
  if (storage?.driver !== 'lru-cache' && storage?.driver !== 'lruCache')
    return
  if (nitro.alias?.['lru-cache'] || await tryResolveModule('lru-cache', directoryToURL(rootDir)))
    return
  const library = await tryResolveModule('lru-cache', import.meta.url)
  if (!library)
    throw new Error('[nuxt-og-image] Cannot resolve the runtime cache dependency "lru-cache".')
  nitro.alias ||= {}
  nitro.alias['lru-cache'] = library
}

function findStorageMount(mounts: NitroConfig['storage'], prefix: string): StorageMount | undefined {
  return Object.entries(mounts || {})
    .map(([key, storage]) => ({ mount: key.replaceAll(':', '/').replace(/^\/+|\/+$/g, ''), storage }))
    .filter(({ mount }) => prefix === mount || prefix.startsWith(`${mount}/`))
    .sort((a, b) => b.mount.length - a.mount.length)[0]
    ?.storage
}

/** Keep the default image cache bounded without changing other Nitro caches. */
export function configureRuntimeCacheStorage(config: Pick<ModuleOptions, 'runtimeCacheStorage'>, nitro: CacheNitroConfig, nitroVersion: 2 | 3): StorageMount | undefined {
  const storageKey = nitroVersion === 3 ? 'kv' : 'storage'
  if (typeof config.runtimeCacheStorage === 'object') {
    nitro[storageKey] ||= {}
    nitro[storageKey]['nuxt-og-image'] = config.runtimeCacheStorage
    return config.runtimeCacheStorage
  }
  if (typeof config.runtimeCacheStorage === 'string')
    return findStorageMount(nitro[storageKey], `${config.runtimeCacheStorage.replaceAll(':', '/').replace(/^\/+|\/+$/g, '')}/nuxt-og-image`)
  if (config.runtimeCacheStorage !== true)
    return

  // A configured ancestor or image mount takes precedence over the fallback.
  const configuredStorage = findStorageMount(nitro[storageKey], DEFAULT_CACHE_MOUNT)
  if (configuredStorage)
    return configuredStorage

  nitro[storageKey] ||= {}
  nitro[storageKey][DEFAULT_CACHE_MOUNT] = {
    driver: 'lru-cache',
    max: 0,
    maxSize: 64 * 1024 * 1024,
  }
  return nitro[storageKey][DEFAULT_CACHE_MOUNT]
}
