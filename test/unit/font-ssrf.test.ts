import http from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fetchSpecialFontUrl, isDataFontUrl, isExternalFontUrl, resolveSameOriginFontUrl } from '../../src/runtime/server/og-image/bindings/font-assets/external-url'
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
function createLoopbackServer(): Promise<{ url: string, origin: string, close: () => Promise<void> }> {
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
        origin: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise<void>(r => server.close(() => r())),
      })
    })
  })
}

describe('isDataFontUrl', () => {
  it('detects inline data: URIs (incl. leading whitespace)', () => {
    expect(isDataFontUrl('data:font/ttf;base64,AAAA')).toBe(true)
    expect(isDataFontUrl(`${SP}data:font/ttf;base64,AAAA`)).toBe(true)
    expect(isDataFontUrl('DATA:font/ttf;base64,AAAA')).toBe(true)
    expect(isDataFontUrl('/fonts/x.ttf')).toBe(false)
    expect(isDataFontUrl('https://x/f.ttf')).toBe(false)
  })
})

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

  // Leading C0 controls / space / tab before "//host" are stripped by the WHATWG
  // URL parser, so the value resolves cross-origin even though a naive scheme
  // check reports it as relative.
  it('classifies control/space/tab-prefixed network-path URLs as external', () => {
    expect(isExternalFontUrl(`${SP}//127.0.0.1:1234/a`)).toBe(true)
    expect(isExternalFontUrl(`${NUL}//169.254.169.254/latest/meta-data/`)).toBe(true)
    expect(isExternalFontUrl(`${TAB}//10.0.0.1/x`)).toBe(true)
  })

  it('treats relative same-origin asset paths as not external', () => {
    expect(isExternalFontUrl('/_fonts/inter.ttf')).toBe(false)
    expect(isExternalFontUrl('/_og-static-fonts/inter.ttf')).toBe(false)
    expect(isExternalFontUrl('/fonts/local.ttf')).toBe(false)
    expect(isExternalFontUrl('fonts/local.ttf')).toBe(false)
  })
})

describe('resolveSameOriginFontUrl', () => {
  const site = 'https://mysite.com'

  it('accepts an absolute URL on the site origin', () => {
    expect(resolveSameOriginFontUrl('https://mysite.com/fonts/x.ttf', site)).toBe('https://mysite.com/fonts/x.ttf')
  })

  it('rejects a cross-origin URL', () => {
    expect(resolveSameOriginFontUrl('https://evil.com/x.ttf', site)).toBeNull()
    expect(resolveSameOriginFontUrl('//evil.com/x.ttf', site)).toBeNull()
  })

  it('rejects when no site URL is configured', () => {
    expect(resolveSameOriginFontUrl('https://mysite.com/x.ttf', undefined)).toBeNull()
    expect(resolveSameOriginFontUrl('https://mysite.com/x.ttf', '')).toBeNull()
  })

  it('rejects control/space-prefixed network-path URLs (resolve cross-origin)', () => {
    expect(resolveSameOriginFontUrl(`${SP}//127.0.0.1/a`, site)).toBeNull()
    expect(resolveSameOriginFontUrl(`${NUL}//169.254.169.254/`, site)).toBeNull()
  })
})

describe('fetchSpecialFontUrl', () => {
  let server: Awaited<ReturnType<typeof createLoopbackServer>>

  beforeAll(async () => {
    server = await createLoopbackServer()
  })
  afterAll(async () => {
    await server.close()
  })

  it('decodes an inline data: font URI (no network)', async () => {
    const b64 = Buffer.from('REAL_FONT_BYTES').toString('base64')
    const buf = await fetchSpecialFontUrl(`data:application/octet-stream;base64,${b64}`, undefined, 3000)
    expect(buf.toString()).toBe('REAL_FONT_BYTES')
  })

  it('rejects a cross-origin external URL as unsupported', async () => {
    await expect(fetchSpecialFontUrl('https://fonts.gstatic.com/a.ttf', 'https://mysite.com', 3000))
      .rejects
      .toThrow(/not supported/)
  })

  it('rejects an external URL when no site URL is configured', async () => {
    await expect(fetchSpecialFontUrl(server.url, undefined, 3000)).rejects.toThrow(/not supported/)
  })

  it('blocks a same-origin URL that resolves to loopback (SSRF guard still applies)', async () => {
    // Sanity check: the server is genuinely reachable, so the rejection proves
    // the guard blocked it, not that the target was simply down.
    expect((await fetch(server.url)).ok).toBe(true)
    // site URL == the loopback origin, so it is "same-origin" — but isBlockedUrl
    // must still refuse to fetch a private/loopback address.
    await expect(fetchSpecialFontUrl(server.url, server.origin, 3000)).rejects.toThrow(/blocked or unreachable/)
  })
})

// The same-origin font fetch must not be turned into an SSRF by an open
// redirect on the app's own origin (e.g. /api/redirect?url=...). trustedHost
// exempts the origin itself, but any redirect that leaves it is re-validated.
describe('trustedHost redirect re-validation', () => {
  let app: { url: string, host: string, close: () => Promise<void> }
  let internalHits: number

  beforeAll(async () => {
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
        res.writeHead(302, { location: `http://127.0.0.1:${internalPort}/meta` })
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
