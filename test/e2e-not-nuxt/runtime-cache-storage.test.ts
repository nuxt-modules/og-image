import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { createResolver } from '@nuxt/kit'
import { exec } from 'tinyexec'
import { describe, expect, it } from 'vitest'
import { ensureLocalModuleStub, extractOgImageUrl } from '../utils'

const { resolve } = createResolver(import.meta.url)
const fixtureDir = resolve('../fixtures/runtime-cache')

async function getFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const socket = createServer()
    socket.once('error', reject)
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address()
      socket.close(() => {
        if (address && typeof address === 'object')
          resolvePort(address.port)
        else
          reject(new Error('The test server did not allocate a port'))
      })
    })
  })
}

describe('production runtime cache storage', () => {
  it.each(['default', 'disabled', 'configured', 'named', 'bounded', 'nested'])('handles %s storage', async (mode) => {
    await ensureLocalModuleStub()
    const build = await exec('pnpm', ['exec', 'nuxt', 'build'], {
      nodeOptions: { cwd: fixtureDir, env: { ...process.env, TEST_RUNTIME_CACHE_MODE: mode, NUXT_OG_IMAGE_SKIP_ONBOARDING: '1' } },
    })
    expect(build.exitCode, `${build.stdout}\n${build.stderr}`).toBe(0)
    if (mode === 'configured')
      expect(`${build.stdout}\n${build.stderr}`).toContain('memory storage without a size limit')
    else
      expect(`${build.stdout}\n${build.stderr}`).not.toContain('memory storage without a size limit')

    const port = String(await getFreePort())
    const server = spawn(process.execPath, ['.output/server/index.mjs'], {
      cwd: fixtureDir,
      env: { ...process.env, PORT: port, NITRO_PORT: port, HOST: '127.0.0.1', NITRO_HOST: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let serverErrors = ''
    server.stderr.on('data', (chunk: Buffer) => {
      serverErrors += chunk.toString()
    })
    try {
      const baseUrl = await new Promise<string>((resolveUrl, reject) => {
        server.once('error', reject)
        server.once('exit', code => reject(new Error(`Server exited before listening: ${code}\n${serverErrors}`)))
        server.stdout.on('data', (chunk: Buffer) => {
          const match = chunk.toString().match(/http:\/\/\S+/)
          if (match)
            resolveUrl(match[0])
        })
      })
      const pageResponse = await fetch(baseUrl)
      const page = await pageResponse.text()
      expect(pageResponse.status, page).toBe(200)
      const imageUrl = extractOgImageUrl(page)
      expect(imageUrl).toBeTruthy()
      const first = await fetch(new URL(imageUrl!, baseUrl))
      const bytes = Buffer.from(await first.arrayBuffer())
      expect(first.status, `${bytes.toString()}\n${serverErrors}`).toBe(200)
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect(first.headers.get('x-og-cache')).toBe(mode === 'disabled' ? 'DISABLED' : 'MISS')
      const second = await fetch(new URL(imageUrl!, baseUrl))
      expect(second.headers.get('x-og-cache')).toBe(mode === 'disabled' ? 'DISABLED' : 'HIT')
      await second.arrayBuffer()
      if (mode === 'disabled') {
        expect(second.headers.get('cache-control')).toContain('no-store')
        return
      }
      const pressure = await fetch(new URL('/api/fill-cache', baseUrl), { method: 'POST' }).then(response => response.json())
      expect(pressure.unrelatedValue).toBe('keep')
      const isBounded = mode === 'default' || mode === 'bounded' || mode === 'nested'
      if (isBounded)
        expect(pressure.retainedBytes).toBeLessThanOrEqual(mode === 'default' ? 64 * 1024 * 1024 : 1024 * 1024)
      else
        expect(pressure.retainedBytes).toBeGreaterThan(64 * 1024 * 1024)
      const afterPressure = await fetch(new URL(imageUrl!, baseUrl))
      expect(afterPressure.headers.get('x-og-cache')).toBe(isBounded ? 'MISS' : 'HIT')
      expect(Buffer.from(await afterPressure.arrayBuffer())).toEqual(bytes)
    }
    finally {
      const exited = once(server, 'exit')
      server.kill('SIGTERM')
      await exited
    }
  }, 180_000)
})
