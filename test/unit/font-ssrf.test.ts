import http from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fetchExternalFont, isExternalFontUrl } from '../../src/runtime/server/og-image/bindings/font-assets/external-url'
import { fetchWithRedirectValidation } from '../../src/runtime/server/util/ssrf'

const FONT_DATA = Buffer.from('fake-font-data-ttf')

// Control characters the WHATWG URL parser strips/ignores, used to smuggle a
// network-path URL past a naive scheme check (Codex finding #1).
const SP = ' '
const TAB = String.fromCharCode(9)
const NUL = String.fromCharCode(0)
const BS = String.fromCharCode(92) // backslash

// Loopback server standing in for any internal SSRF target (metadata service,
// admin panel, etc.). It answers 2xx with non-font bytes — the exact shape the
// GHSA-q8hw-4fvp-9rwv side channel relied on.
function createLoopbackServer(): Promise<{ url: string, host: string, close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((_, res) => {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
      res.end(FONT_DATA)
    })
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string')
        return reject(new Error('unexpected address'))
      resolve({
        url: `http://127.0.0.1:${addr.port}/internal-service`,
        host: `127.0.0.1:${addr.port}`,
        close: () => new Promise<void>(r => server.close(() => r())),
      })
    })
  })
}

describe('isExternalFontUrl', () => {
  it('classifies absolute and protocol-relative URLs as external', () => {
    expect(isExternalFontUrl('http://evil.com/font.ttf')).toBe(true)
    expect(isExternalFontUrl('https://evil.com/font.ttf')).toBe(true)
    expect(isExternalFontUrl('//evil.com/font.ttf')).toBe(true)
  })

  it('classifies backslash-authority forms as external', () => {
    expect(isExternalFontUrl(`${BS}${BS}evil.com/font.ttf`)).toBe(true)
    expect(isExternalFontUrl(`/${BS}evil.com/font.ttf`)).toBe(true)
  })

  // Codex finding #1: leading C0 controls / space / tab before "//host" are
  // stripped by the WHATWG URL parser, so the value resolves cross-origin even
  // though a naive `hasProtocol` check reports it as relative.
  it('classifies control/space/tab-prefixed network-path URLs as external', () => {
    expect(isExternalFontUrl(`${SP}//127.0.0.1:1234/a`)).toBe(true)
    expect(isExternalFontUrl(`${NUL}//169.254.169.254/latest/meta-data/`)).toBe(true)
    expect(isExternalFontUrl(`${TAB}//10.0.0.1/x`)).toBe(true)
  })

  it('treats same-origin asset paths as internal (not external)', () => {
    expect(isExternalFontUrl('/_fonts/inter.ttf')).toBe(false)
    expect(isExternalFontUrl('/_og-static-fonts/inter.ttf')).toBe(false)
    expect(isExternalFontUrl('/fonts/local.ttf')).toBe(false)
    expect(isExternalFontUrl('fonts/local.ttf')).toBe(false)
  })

  it('treats inline data: font URIs as internal (no network)', () => {
    expect(isExternalFontUrl('data:font/ttf;base64,AAAA')).toBe(false)
  })
})

describe('fetchExternalFont — default-deny + allowlist', () => {
  let server: Awaited<ReturnType<typeof createLoopbackServer>>

  beforeAll(async () => {
    server = await createLoopbackServer()
  })
  afterAll(async () => {
    await server.close()
  })

  it('denies any external host by default (empty allowlist)', async () => {
    // Sanity check: the server is genuinely reachable, so the rejection below
    // proves the guard blocked it, not that the target was simply down.
    const direct = await fetch(server.url)
    expect(direct.ok).toBe(true)

    await expect(fetchExternalFont(server.url, 3000, [])).rejects.toThrow(/not allowed/)
    await expect(fetchExternalFont('https://fonts.gstatic.com/a.ttf', 3000, [])).rejects.toThrow(/not allowed/)
  })

  it('blocks loopback even when the host IS allowlisted (defense in depth)', async () => {
    // An allowlisted host that still points at loopback must be rejected by the
    // isBlockedUrl layer, not fetched.
    await expect(fetchExternalFont(server.url, 3000, [server.host])).rejects.toThrow(/blocked or unreachable/)
  })

  it('blocks the AWS metadata endpoint even if allowlisted', async () => {
    await expect(
      fetchExternalFont('http://169.254.169.254/latest/meta-data/', 3000, ['169.254.169.254']),
    ).rejects.toThrow(/blocked or unreachable/)
  })

  it('blocks RFC1918 private ranges even if allowlisted', async () => {
    await expect(fetchExternalFont('http://10.0.0.1/font.ttf', 3000, ['10.0.0.1'])).rejects.toThrow()
    await expect(fetchExternalFont('http://192.168.0.1/font.ttf', 3000, ['192.168.0.1'])).rejects.toThrow()
  })

  it('rejects an invalid URL', async () => {
    await expect(fetchExternalFont('not a url', 3000, [])).rejects.toThrow(/Invalid external font URL/)
  })
})

// The same-origin font fetch must not be turned into an SSRF by an open
// redirect on the app's own origin (e.g. /api/redirect?url=...). trustedHost
// exempts the origin itself, but any redirect that leaves it is re-validated.
describe('trustedHost redirect re-validation', () => {
  let app: { url: string, host: string, redirectTo: (loc: string) => void, close: () => Promise<void> }
  let internalHits: number

  beforeAll(async () => {
    let location = ''
    internalHits = 0
    const internal = http.createServer((_, res) => {
      internalHits++
      res.writeHead(200)
      res.end('SECRET')
    })
    await new Promise<void>(r => internal.listen(0, '127.0.0.1', () => r()))
    const internalPort = (internal.address() as import('node:net').AddressInfo).port

    const server = http.createServer((req, res) => {
      if (req.url === '/font.ttf') {
        res.writeHead(200, { 'Content-Type': 'font/ttf' })
        res.end(Buffer.from('real-font'))
        return
      }
      if (req.url?.startsWith('/redirect')) {
        res.writeHead(302, { location: location || `http://127.0.0.1:${internalPort}/meta` })
        res.end()
        return
      }
      res.writeHead(404)
      res.end()
    })
    await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()))
    const port = (server.address() as import('node:net').AddressInfo).port
    app = {
      url: `http://127.0.0.1:${port}`,
      host: `127.0.0.1:${port}`,
      redirectTo: (loc: string) => { location = loc },
      close: async () => {
        await new Promise<void>(r => server.close(() => r()))
        await new Promise<void>(r => internal.close(() => r()))
      },
    }
  })
  afterAll(async () => {
    await app.close()
  })

  it('fetches a plain same-origin font (trusted host not blocked)', async () => {
    const ab = await fetchWithRedirectValidation(`${app.url}/font.ttf`, { timeout: 3000, trustedHost: app.host })
    expect(ab).not.toBeNull()
    expect(Buffer.from(ab!).toString()).toBe('real-font')
  })

  it('blocks an open redirect from the trusted origin to an internal target', async () => {
    const before = internalHits
    const ab = await fetchWithRedirectValidation(`${app.url}/redirect`, { timeout: 3000, trustedHost: app.host })
    expect(ab).toBeNull()
    // The internal target must never have been contacted.
    expect(internalHits).toBe(before)
  })
})
