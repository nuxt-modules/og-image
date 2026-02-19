import http from 'node:http'
import { $fetch } from 'ofetch'
import { describe, expect, it } from 'vitest'

const FONT_DATA = Buffer.from('fake-font-data-ttf')

function createServer(host: string): Promise<{ url: string, close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((_, res) => {
      res.writeHead(200, { 'Content-Type': 'font/ttf' })
      res.end(FONT_DATA)
    })
    server.listen(0, host, () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string')
        return reject(new Error('unexpected address'))
      const url = addr.family === 'IPv6'
        ? `http://[${addr.address}]:${addr.port}`
        : `http://${addr.address}:${addr.port}`
      resolve({
        url,
        close: () => new Promise<void>(r => server.close(() => r())),
      })
    })
  })
}

/**
 * Replicates the IPv6 font fetching bug in dev-prerender.ts.
 *
 * Before the fix, when getNitroOrigin() returned an IPv6 origin like
 * `http://[::1]:3000`, the $fetch call was skipped entirely because
 * `origin.includes('::1')` was true. This caused a fallback to
 * event.$fetch which can't reach public/ static files in dev
 * (only Vite's HTTP middleware serves those, not Nitro internal routing).
 *
 * The fix removes the IPv6 guard — $fetch/undici handles [::1] URLs fine.
 */
describe('ipv6 font fetch', () => {
  it('old code skipped $fetch entirely for IPv6 origins', () => {
    const origin = 'http://[::1]:3000'

    // Old guard: `!origin.includes('::1')` → false → skip $fetch
    const oldGuard = !origin.includes('::1')
    expect(oldGuard).toBe(false)

    // This meant IPv6 users went straight to event.$fetch which can't
    // serve public/ static files in dev mode (Vue Router warnings)
  })

  it('$fetch works with IPv6 [::1] origin', async () => {
    let server: Awaited<ReturnType<typeof createServer>> | undefined
    try {
      server = await createServer('::1')
    }
    catch {
      // IPv6 not available on this machine — skip
      return
    }

    try {
      const origin = server.url
      expect(origin).toContain('[::1]')

      // $fetch handles IPv6 bracket notation correctly
      const data = await $fetch('/font.ttf', {
        responseType: 'arrayBuffer',
        baseURL: origin,
      })
      expect(Buffer.from(data)).toEqual(FONT_DATA)
    }
    finally {
      await server.close()
    }
  })

  it('native fetch works with IPv6 URL construction', async () => {
    let server: Awaited<ReturnType<typeof createServer>> | undefined
    try {
      server = await createServer('::1')
    }
    catch {
      return
    }

    try {
      const origin = server.url
      const fullPath = '/fonts/inter.ttf'
      // URL constructor handles IPv6 bracket notation
      const url = new URL(fullPath, origin).href
      expect(url).toContain('[::1]')

      const res = await fetch(url)
      expect(res.ok).toBe(true)
      expect(Buffer.from(await res.arrayBuffer())).toEqual(FONT_DATA)
    }
    finally {
      await server.close()
    }
  })
})
