/** What a request asks of the runtime cache through its `purge` query value. */
export type PurgeRequest = { _tag: 'None' } | { _tag: 'Authorized' } | { _tag: 'Denied' }

/**
 * Constant-time string comparison. Works on edge runtimes without node:crypto.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length)
    return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++)
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

/**
 * Parse the `purge` query value. A purge needs the signing secret as its
 * value, the same secret that signs image URLs. Without a secret, no purge
 * can pass.
 */
export function parsePurgeRequest(value: unknown, secret: string | false | undefined): PurgeRequest {
  if (value === undefined)
    return { _tag: 'None' }
  if (typeof secret !== 'string' || !secret || typeof value !== 'string')
    return { _tag: 'Denied' }
  return safeCompare(value, secret) ? { _tag: 'Authorized' } : { _tag: 'Denied' }
}
