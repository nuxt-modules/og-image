import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'pathe'

export async function readPackageManifest(path: string) {
  return JSON.parse(await readFile(path, 'utf8'))
}

/**
 * Walk up from `fromUrl` to the nearest `package.json`.
 *
 * Replaces `findPackageJSON` from `node:module` (Node 22.14+), which runtimes such as Bun
 * don't implement; a static named import of it fails at link time there.
 */
export function findNearestPackageJson(fromUrl: string | URL): string | undefined {
  let dir = dirname(fileURLToPath(fromUrl))
  while (true) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate))
      return candidate
    const parent = dirname(dir)
    if (parent === dir)
      return undefined
    dir = parent
  }
}
