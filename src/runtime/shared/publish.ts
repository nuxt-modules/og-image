import { normalizeKey } from 'unstorage'

interface PublishConfig {
  storage: string
  baseURL: string
}

export function parsePublishConfig(input: unknown): { _tag: 'Ok', value: PublishConfig } | { _tag: 'Err', reason: string } {
  if (!input || typeof input !== 'object')
    return { _tag: 'Err', reason: 'Set publish.storage and publish.baseURL.' }
  const config = input as Record<string, unknown>
  if (typeof config.storage !== 'string' || !config.storage.trim() || !normalizeKey(config.storage))
    return { _tag: 'Err', reason: 'Set publish.storage to a Nitro storage mount name.' }
  if (typeof config.baseURL !== 'string' || !URL.canParse(config.baseURL))
    return { _tag: 'Err', reason: 'Set publish.baseURL to the public HTTP URL for uploaded images.' }
  const url = new URL(config.baseURL)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.href.includes('?') || url.href.includes('#'))
    return { _tag: 'Err', reason: 'Set publish.baseURL to an HTTP URL without credentials, query, or fragment.' }
  return { _tag: 'Ok', value: { storage: normalizeKey(config.storage), baseURL: url.href.replace(/\/+$/, '') } }
}

export function hasPublishMount(mount: string, storage: Record<string, unknown>): boolean {
  return Object.keys(storage).some(key => normalizeKey(key) === normalizeKey(mount))
}
