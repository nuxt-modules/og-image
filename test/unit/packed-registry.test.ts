import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, expect, it } from 'vitest'
import { createPackedRegistry } from '../../scripts/packed-registry'

const exec = promisify(execFile)
const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse())
    await close()
})

async function packFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'packed-registry-test-'))
  cleanup.push(() => rm(dir, { recursive: true, force: true }))
  await mkdir(join(dir, 'package'))
  await writeFile(join(dir, 'package/package.json'), JSON.stringify({ name: '@fixture/producer', version: '5.0.0', dependencies: { vue: '^3.5.0' } }))
  const archive = join(dir, 'producer.tgz')
  await exec('tar', ['-czf', archive, '-C', dir, 'package'])
  return archive
}

it('advertises the genuine packed version and serves the integrity-matched scoped archive', async () => {
  const archive = await packFixture()
  const created = new Date('2026-10-06T00:00:00.000Z')
  await utimes(archive, created, created)
  const registry = await createPackedRegistry({ '@fixture/producer': archive })
  cleanup.push(registry.close)
  const response = await fetch(`${registry.origin}/@fixture%2fproducer`)
  const metadata = await response.json()
  expect(response.status).toBe(200)
  const version = metadata.versions['5.0.0']
  expect(metadata.time['5.0.0']).toBe(created.toISOString())
  expect(version.version).toBe('5.0.0')
  expect(version.dependencies.vue).toBe('^3.5.0')
  const transported = Buffer.from(await (await fetch(version.dist.tarball)).arrayBuffer())
  const downloaded = `${archive}.downloaded`
  await writeFile(downloaded, transported)
  const { stdout } = await exec('tar', ['-xOf', downloaded, 'package/package.json'])
  const installedManifest = JSON.parse(stdout)
  expect(installedManifest.name).toBe('@fixture/producer')
  expect(installedManifest.version).toBe(version.version)
  expect(version.dist.integrity).toBe(`sha512-${createHash('sha512').update(transported).digest('base64')}`)
})

it('redirects unknown package metadata to the official registry', async () => {
  const registry = await createPackedRegistry({})
  cleanup.push(registry.close)
  const response = await fetch(`${registry.origin}/@nuxt%2fkit?version=4.6.0`, { redirect: 'manual' })
  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe('https://registry.npmjs.org/@nuxt%2fkit?version=4.6.0')
})

it('rejects a producer archive whose identity differs from its map entry', async () => {
  const archive = await packFixture()
  await expect(createPackedRegistry({ 'another-package': archive })).rejects.toThrow('Packed dependency identity does not match: another-package')
})
