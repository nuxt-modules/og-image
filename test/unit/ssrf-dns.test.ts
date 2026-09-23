import type { AddressInfo } from 'node:net'
import http from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { fetchWithRedirectValidation, isBlockedUrl } from '../../src/runtime/server/util/ssrf'

// A public-looking name that resolves to an internal address must not pass the
// guard just because its literal host is not an IP.

const answers: Record<string, { address: string, family: number }[]> = {
  'internal.test': [{ address: '127.0.0.1', family: 4 }],
  'mixed.test': [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }],
  'mapped.test': [{ address: '::ffff:127.0.0.1', family: 6 }],
}

vi.mock('node:dns', async (importOriginal) => {
  const dns = await importOriginal<typeof import('node:dns')>()
  const lookup = (hostname: string, options: any, callback: any) => {
    const fake = answers[hostname]
    if (!fake)
      return dns.lookup(hostname, options, callback)
    const family = options.family === 4 || options.family === 6 ? options.family : 0
    const matches = family ? fake.filter(a => a.family === family) : fake
    options.all ? callback(null, matches) : callback(null, matches[0]!.address, matches[0]!.family)
  }
  return { ...dns, default: { ...dns, lookup }, lookup }
})

let server: http.Server
let port: number

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/redirect-internal') {
      res.writeHead(302, { location: `http://internal.test:${port}/secret` })
      return res.end()
    }
    res.writeHead(200)
    res.end('secret')
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  port = (server.address() as AddressInfo).port
})
afterAll(() => new Promise<void>(r => server.close(() => r())))

const read = (ab: ArrayBuffer | null) => ab && new TextDecoder().decode(ab)

describe('fetchWithRedirectValidation resolved addresses', () => {
  it.each(['internal.test', 'mixed.test', 'mapped.test'])('blocks %s', async (host) => {
    expect(await fetchWithRedirectValidation(`http://${host}:${port}/`, { timeout: 2000 })).toBeNull()
  })

  it('blocks a redirect to a name that resolves internally', async () => {
    const trustedHost = `127.0.0.1:${port}`
    expect(await fetchWithRedirectValidation(`http://${trustedHost}/redirect-internal`, { timeout: 2000, trustedHost })).toBeNull()
  })

  it('still fetches the trusted host', async () => {
    const trustedHost = `127.0.0.1:${port}`
    expect(read(await fetchWithRedirectValidation(`http://${trustedHost}/`, { timeout: 2000, trustedHost }))).toBe('secret')
  })

  it('blocks localhost with a trailing dot', async () => {
    expect(await fetchWithRedirectValidation(`http://localhost.:${port}/`, { timeout: 2000 })).toBeNull()
  })
})

describe('isBlockedUrl reserved ranges', () => {
  it.each([
    'http://100.100.100.200/',
    'http://198.18.0.1/',
    'http://224.0.0.1/',
    'http://255.255.255.255/',
    'http://[2001::1]/',
    'http://[100::1]/',
    'http://localhost./',
  ])('blocks %s', (url) => {
    expect(isBlockedUrl(url)).toBe(true)
  })

  it('allows a public address', () => {
    expect(isBlockedUrl('http://93.184.216.34/')).toBe(false)
  })
})
