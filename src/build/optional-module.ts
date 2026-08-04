import { pathToFileURL } from 'node:url'
import { directoryToURL, tryResolveModule } from '@nuxt/kit'
import { dirname } from 'pathe'

export async function resolveOptionalModulePath(id: string, rootDir: string, fallbackPackages: string[] = []): Promise<string | undefined> {
  const rootUrl = directoryToURL(rootDir)
  const direct = await tryResolveModule(id, rootUrl)
  if (direct)
    return direct

  for (const pkg of fallbackPackages) {
    const pkgJson = await tryResolveModule(`${pkg}/package.json`, rootUrl)
    if (!pkgJson)
      continue
    const nested = await tryResolveModule(id, directoryToURL(dirname(pkgJson)))
    if (nested)
      return nested
  }
}

export async function importResolvedModule<T>(id: string, resolvedPath?: string): Promise<T> {
  return await import(resolvedPath ? pathToFileURL(resolvedPath).href : id) as T
}

export async function importOptionalPeer<T>(id: string, resolvedPath: string | undefined, usage: string): Promise<T> {
  try {
    return await importResolvedModule<T>(id, resolvedPath)
  }
  catch (cause) {
    throw new Error(
      `[nuxt-og-image] Missing optional peer dependency "${id}". Install it to use ${usage}.`,
      { cause },
    )
  }
}
