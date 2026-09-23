// Node fetch for the SSRF guard. The `lookup` hook checks every address a name
// resolves to at connect time, so the address checked is the address used and
// a DNS rebinding answer gets no second query. Runtimes whose `node:http`
// ignores `lookup` (possibly Bun or Deno) skip the address check.

import type { LookupAddress } from 'node:dns'
import type { LookupFunction } from 'node:net'
import type { GuardedFetchInit } from './web'
import { lookup as dnsLookup } from 'node:dns'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { Readable } from 'node:stream'

function guardedLookup(isBlocked: (address: string) => boolean): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (err, addresses: LookupAddress[]) => {
      if (err)
        return callback(err, '', 0)
      const blocked = addresses.find(a => isBlocked(a.address))
      if (blocked)
        return callback(new Error(`[Nuxt OG Image] ${hostname} resolves to blocked address ${blocked.address}.`), '', 0)
      if (options.all)
        return (callback as (err: null, addresses: LookupAddress[]) => void)(null, addresses)
      callback(null, addresses[0]!.address, addresses[0]!.family)
    })
  }
}

export function guardedFetch(url: string, { headers, signal, isBlockedAddress }: GuardedFetchInit): Promise<Response> {
  const request = url.startsWith('https:') ? httpsRequest : httpRequest
  return new Promise((resolve, reject) => {
    const req = request(url, {
      // Match the defaults that `fetch` sent before this transport existed.
      headers: { 'accept': '*/*', 'user-agent': 'node', ...headers },
      signal,
      lookup: guardedLookup(isBlockedAddress ?? (() => false)),
      // A fresh socket per hop: never reuse a connection nobody checked.
      agent: false,
    }, (res) => {
      const status = res.statusCode ?? 0
      const responseHeaders = new Headers()
      for (const [name, value] of Object.entries(res.headers)) {
        for (const v of [value ?? []].flat())
          responseHeaders.append(name, v)
      }
      const body = status === 204 || status === 304 ? null : Readable.toWeb(res) as ReadableStream<Uint8Array>
      resolve(new Response(body, { status, headers: responseHeaders }))
    })
    req.on('error', reject)
    req.end()
  })
}
