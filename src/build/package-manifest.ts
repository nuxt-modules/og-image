import { readFile } from 'node:fs/promises'

export async function readPackageManifest(path: string) {
  return JSON.parse(await readFile(path, 'utf8'))
}
