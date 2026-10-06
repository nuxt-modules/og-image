import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { isAbsolute } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)

/** Serve genuine local producer archives through ordinary npm version metadata. */
export async function createPackedRegistry(tarballs: Record<string, string>) {
  const packages = new Map<string, { manifest: { name: string, version: string }, bytes: Buffer, path: string, created: string }>()
  for (const [name, archive] of Object.entries(tarballs)) {
    if (typeof archive !== 'string' || !isAbsolute(archive))
      throw new Error(`Packed dependency requires an absolute path: ${name}`)
    const bytes = await readFile(archive)
    const { stdout } = await exec('tar', ['-xOf', archive, 'package/package.json'])
    const manifest = JSON.parse(stdout)
    if (manifest.name !== name || typeof manifest.version !== 'string')
      throw new Error(`Packed dependency identity does not match: ${name}`)
    const created = (await stat(archive)).mtime.toISOString()
    packages.set(name, { manifest, bytes, path: `/__packed__/${packages.size}.tgz`, created })
  }
  let origin = ''
  const server = createServer((request, response) => {
    const path = new URL(request.url || '/', origin).pathname
    const archive = [...packages.values()].find(pkg => pkg.path === path)
    if (archive) {
      response.writeHead(200, { 'Content-Type': 'application/octet-stream' })
      response.end(archive.bytes)
      return
    }
    const name = decodeURIComponent(path.slice(1))
    const packed = packages.get(name)
    if (packed) {
      const { manifest, bytes } = packed
      const version = {
        ...manifest,
        dist: {
          tarball: `${origin}${packed.path}`,
          shasum: createHash('sha1').update(bytes).digest('hex'),
          integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
        },
      }
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ name, 'dist-tags': { latest: manifest.version }, 'versions': { [manifest.version]: version }, 'time': { [manifest.version]: packed.created } }))
      return
    }
    // Official registry metadata preserves provenance checks for external dependencies.
    response.writeHead(307, { Location: `https://registry.npmjs.org${request.url || '/'}` })
    response.end()
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Packed registry did not obtain a TCP address')
  origin = `http://127.0.0.1:${address.port}`
  return {
    origin,
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections()
      server.close(error => error ? reject(error) : resolve())
    }),
  }
}
