import { describe, expect, it } from 'vitest'
import { expandIPv6, isBlockedUrl } from '../../src/runtime/server/util/ssrf'

describe('expandIPv6', () => {
  it('expands :: shorthand', () => {
    expect(expandIPv6('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 1])
    expect(expandIPv6('::')).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    expect(expandIPv6('fe80::1')).toEqual([0xFE80, 0, 0, 0, 0, 0, 0, 1])
  })

  it('expands embedded IPv4', () => {
    expect(expandIPv6('::ffff:127.0.0.1')).toEqual([0, 0, 0, 0, 0, 0xFFFF, 0x7F00, 1])
    expect(expandIPv6('64:ff9b::8.8.8.8')).toEqual([0x64, 0xFF9B, 0, 0, 0, 0, 0x0808, 0x0808])
  })

  it('handles hex-form IPv4-mapped (::ffff:7f00:1)', () => {
    expect(expandIPv6('::ffff:7f00:1')).toEqual([0, 0, 0, 0, 0, 0xFFFF, 0x7F00, 1])
  })

  it('strips zone id', () => {
    expect(expandIPv6('fe80::1%eth0')).toEqual([0xFE80, 0, 0, 0, 0, 0, 0, 1])
  })

  it('rejects malformed input', () => {
    expect(expandIPv6('')).toBeNull()
    expect(expandIPv6('::1::2')).toBeNull()
    expect(expandIPv6('1:2:3:4:5:6:7')).toBeNull() // too few groups, no ::
    expect(expandIPv6('1:2:3:4:5:6:7:8:9')).toBeNull() // too many
    expect(expandIPv6('xyz::1')).toBeNull()
    expect(expandIPv6('::ffff:300.1.1.1')).toBeNull() // out-of-range octet
  })
})

describe('isBlockedUrl — known-good controls', () => {
  it('blocks dotted-decimal loopback', () => {
    expect(isBlockedUrl('http://127.0.0.1/')).toBe(true)
    expect(isBlockedUrl('http://127.0.0.1:8080/x')).toBe(true)
  })

  it('blocks RFC 1918 ranges', () => {
    expect(isBlockedUrl('http://10.0.0.1/')).toBe(true)
    expect(isBlockedUrl('http://172.16.5.5/')).toBe(true)
    expect(isBlockedUrl('http://172.31.255.255/')).toBe(true)
    expect(isBlockedUrl('http://192.168.1.1/')).toBe(true)
  })

  it('blocks link-local IPv4', () => {
    expect(isBlockedUrl('http://169.254.169.254/')).toBe(true) // AWS IMDS
  })

  it('blocks 0.0.0.0/8', () => {
    expect(isBlockedUrl('http://0.0.0.0/')).toBe(true)
  })

  it('blocks localhost names', () => {
    expect(isBlockedUrl('http://localhost/')).toBe(true)
    expect(isBlockedUrl('http://app.localhost/')).toBe(true)
  })

  it('blocks integer-encoded IPv4', () => {
    expect(isBlockedUrl('http://2130706433/')).toBe(true) // 127.0.0.1
    expect(isBlockedUrl('http://0x7f000001/')).toBe(true) // 127.0.0.1
  })

  it('blocks octal/shorthand IPv4 (URL parser canonicalizes)', () => {
    expect(isBlockedUrl('http://0177.0.0.1/')).toBe(true)
    expect(isBlockedUrl('http://127.1/')).toBe(true)
  })

  it('blocks ::1 IPv6 loopback', () => {
    expect(isBlockedUrl('http://[::1]/')).toBe(true)
    expect(isBlockedUrl('http://[::1]:8080/')).toBe(true)
  })

  it('blocks fc00::/7 unique-local', () => {
    expect(isBlockedUrl('http://[fc00::1]/')).toBe(true)
    expect(isBlockedUrl('http://[fdff::1]/')).toBe(true)
  })

  it('blocks fe80::/10 link-local', () => {
    expect(isBlockedUrl('http://[fe80::1]/')).toBe(true)
    expect(isBlockedUrl('http://[fe80::1%25eth0]/')).toBe(true) // zone id
  })

  it('blocks non-http(s) schemes', () => {
    expect(isBlockedUrl('file:///etc/passwd')).toBe(true)
    expect(isBlockedUrl('gopher://127.0.0.1/')).toBe(true)
    expect(isBlockedUrl('ftp://example.com/')).toBe(true)
  })

  it('blocks unparseable URLs', () => {
    expect(isBlockedUrl('not a url')).toBe(true)
    expect(isBlockedUrl('')).toBe(true)
  })
})

describe('isBlockedUrl — GHSA-c2rm-g55x-8hr5 bypasses', () => {
  it('blocks IPv6-mapped loopback in pure-hex form (::ffff:7f00:1)', () => {
    expect(isBlockedUrl('http://[::ffff:7f00:1]/')).toBe(true)
    expect(isBlockedUrl('http://[::ffff:7f00:1]:8765/path')).toBe(true)
  })

  it('blocks IPv6-mapped RFC1918 in pure-hex form', () => {
    expect(isBlockedUrl('http://[::ffff:c0a8:101]/')).toBe(true) // 192.168.1.1
    expect(isBlockedUrl('http://[::ffff:a00:1]/')).toBe(true) // 10.0.0.1 (g6=0x0a00)
  })

  it('blocks fec0::/10 site-local (RFC 3879 deprecated)', () => {
    expect(isBlockedUrl('http://[fec0::1]/')).toBe(true)
    expect(isBlockedUrl('http://[feff::1]/')).toBe(true)
  })

  it('blocks 5f00::/16 SRv6 SIDs (RFC 9602)', () => {
    expect(isBlockedUrl('http://[5f00::1]/')).toBe(true)
    expect(isBlockedUrl('http://[5f00:ffff::1]/')).toBe(true)
  })

  it('blocks 3fff::/20 documentation v2 (RFC 9637)', () => {
    expect(isBlockedUrl('http://[3fff::1]/')).toBe(true)
    expect(isBlockedUrl('http://[3fff:ffff::1]/')).toBe(true)
  })

  it('blocks 64:ff9b:1::/48 NAT64 local-use (RFC 8215)', () => {
    expect(isBlockedUrl('http://[64:ff9b:1::1]/')).toBe(true)
    expect(isBlockedUrl('http://[64:ff9b:1::7f00:1]/')).toBe(true)
  })

  it('blocks 64:ff9b::/96 NAT64 well-known prefix with embedded private IPv4', () => {
    expect(isBlockedUrl('http://[64:ff9b::7f00:1]/')).toBe(true) // embedded 127.0.0.1
    expect(isBlockedUrl('http://[64:ff9b::a00:1]/')).toBe(true) // embedded 10.0.0.1
  })

  it('blocks 2001:db8::/32 documentation', () => {
    expect(isBlockedUrl('http://[2001:db8::1]/')).toBe(true)
  })
})

describe('isBlockedUrl — public addresses pass through', () => {
  it('allows public IPv4', () => {
    expect(isBlockedUrl('http://8.8.8.8/')).toBe(false)
    expect(isBlockedUrl('https://1.1.1.1/')).toBe(false)
  })

  it('allows public hostnames', () => {
    expect(isBlockedUrl('https://example.com/img.png')).toBe(false)
    expect(isBlockedUrl('https://cdn.example.com/path?q=1')).toBe(false)
  })

  it('allows public IPv6', () => {
    expect(isBlockedUrl('http://[2606:4700::1111]/')).toBe(false) // Cloudflare
    expect(isBlockedUrl('http://[2001:4860:4860::8888]/')).toBe(false) // Google
  })

  it('allows 64:ff9b::/96 with public embedded IPv4', () => {
    expect(isBlockedUrl('http://[64:ff9b::8.8.8.8]/')).toBe(false)
  })
})
