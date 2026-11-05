import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { join } from 'pathe'
import { expect, it } from 'vitest'
import { findNearestPackageJson, readPackageManifest } from './package-manifest'

it('reads versions and renderer dependencies from an explicit manifest', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'og-manifest-'))
  try {
    const path = join(dir, 'package.json')
    await writeFile(path, JSON.stringify({ name: 'satori', version: '0.33.0', dependencies: { harfbuzzjs: '^0.8.0' } }))
    expect(await readPackageManifest(path)).toEqual({ name: 'satori', version: '0.33.0', dependencies: { harfbuzzjs: '^0.8.0' } })
    await writeFile(path, '{ broken')
    await expect(readPackageManifest(path)).rejects.toThrow(SyntaxError)
    await expect(readPackageManifest(join(dir, 'missing.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

it('walks up from a file URL to the nearest package.json', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'og-manifest-walk-'))
  try {
    const nestedDir = join(dir, 'dist', 'runtime')
    await mkdir(nestedDir, { recursive: true })
    const entryUrl = pathToFileURL(join(nestedDir, 'module.mjs'))
    const manifestPath = join(dir, 'package.json')
    await writeFile(manifestPath, JSON.stringify({ name: 'nuxt-og-image', version: '7.0.7' }))
    expect(findNearestPackageJson(entryUrl)).toBe(manifestPath)
    expect(findNearestPackageJson(entryUrl.href)).toBe(manifestPath)
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})
