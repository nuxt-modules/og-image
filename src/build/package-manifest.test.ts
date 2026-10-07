import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { readPackageManifest } from './package-manifest'

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
