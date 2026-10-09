import type { Storage } from 'unstorage'
import { parseURL } from 'ufo'
import { parsePublishConfig } from '../../../shared/publish'
import { extractEncodedSegment, hashOgImageOptions } from '../../../shared/urlEncoding'
import { withTimeout } from '../../util/withTimeout'

interface PublishManifest {
  objectKey: string
  expiresAt: number
}

interface PublishStorage {
  getMount: Storage['getMount']
  hasItem: (key: string) => Promise<boolean>
  getItem: (key: string) => Promise<unknown>
  setItem: (key: string, value: object, options?: Record<string, unknown>) => Promise<void>
  setItemRaw: (key: string, value: Uint8Array, options?: Record<string, unknown>) => Promise<void>
}

interface PublishInput {
  storage: PublishStorage
  mount: string
  baseURL: string
  key: string
  extension: 'png' | 'jpg' | 'jpeg' | 'webp'
  maxAgeSeconds: number
  timeoutMs?: number
  now: () => number
}

interface Published { _tag: 'Published', url: string, objectKey: string }
interface Unavailable { _tag: 'Unavailable', reason: unknown }
interface PublishTarget { _tag: 'Target', storage: Omit<PublishStorage, 'getMount'>, baseURL: string }

/** Normalize signed image paths without loading a renderer during page SSR. */
export function getPublishKey(url: string, defaults: Record<string, unknown>, cacheVersion: string): string {
  const { pathname: path, host, protocol } = parseURL(url)
  const extension = path.split('.').pop()!
  const segment = decodeURIComponent(extractEncodedSegment(path, extension)).replace(/,s_[^,]+$/, '')
  return hashOgImageOptions({ segment, defaults, host, protocol }, '', cacheVersion)
}

/** A page may reference the bucket only while its manifest and object both exist. */
export async function getPublishedImage(input: PublishInput): Promise<Published | Unavailable | { _tag: 'Miss' }> {
  return withTimeout((async () => {
    const target = resolveTarget(input)
    return target._tag === 'Unavailable' ? target : lookupPublishedImage(input, target)
  })(), input.timeoutMs ?? 15000, 'OG image publish lookup').catch(reason => ({ _tag: 'Unavailable' as const, reason }))
}

/** Publish immutable bytes. Manifest expiry limits reuse, never object retention. */
export async function publishImage(input: PublishInput & {
  render: () => Promise<Uint8Array>
  /** Original buffer expiry, preserved across uploads and cache hits. */
  expiresAt?: number
  /** Fresh runtime bytes replace the manifest even if an older object is still reusable. */
  force?: boolean
}): Promise<Published | Unavailable> {
  // Storage failures are expected in preview deployments. Keep the app image URL.
  return withTimeout((async (): Promise<Published | Unavailable> => {
    const target = resolveTarget(input)
    if (target._tag === 'Unavailable')
      return target
    if (!input.force) {
      const cached = await lookupPublishedImage(input, target)
      if (cached._tag === 'Published')
        return cached
    }
    const { storage } = target
    const bytes = await input.render()
    // Changed remote assets never overwrite images referenced by older HTML.
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    const objectKey = `${hash}.${input.extension}`
    if (!await storage.hasItem(objectKey)) {
      await storage.setItemRaw(objectKey, bytes, {
        httpMetadata: {
          contentType: `image/${input.extension === 'jpg' ? 'jpeg' : input.extension}`,
          cacheControl: 'public, max-age=31536000, immutable',
        },
      })
      if (!await storage.hasItem(objectKey))
        return { _tag: 'Unavailable', reason: 'Publish storage did not retain the image.' }
    }
    // Image objects have no driver TTL. Only manifests expire.
    await storage.setItem(manifestKey(input), {
      objectKey,
      expiresAt: input.expiresAt ?? input.now() + (Number.isFinite(input.maxAgeSeconds) ? Math.max(0, input.maxAgeSeconds) : 0) * 1000,
    }, { ttl: Math.max(60, Number.isFinite(input.maxAgeSeconds) ? Math.ceil(input.maxAgeSeconds) : 60) })
    return published(target, objectKey)
  })(), input.timeoutMs ?? 15000, 'OG image publication').catch(reason => ({ _tag: 'Unavailable' as const, reason }))
}

function resolveTarget(input: PublishInput): PublishTarget | Unavailable {
  const parsed = parsePublishConfig({ storage: input.mount, baseURL: input.baseURL })
  if (parsed._tag === 'Err')
    return { _tag: 'Unavailable', reason: parsed.reason }
  const { storage: mount, baseURL } = parsed.value
  const mounted = input.storage.getMount(`${mount}:`)
  // Unstorage otherwise falls through to root memory storage, creating broken public URLs.
  if (!mount || mounted.base !== `${mount}:` || !mounted.driver.setItemRaw)
    return { _tag: 'Unavailable', reason: 'Publish storage needs a mounted driver with raw writes.' }
  const prefix = `${mount}:`
  const storage = {
    hasItem: (key: string) => input.storage.hasItem(prefix + key),
    getItem: (key: string) => input.storage.getItem(prefix + key),
    setItem: (key: string, value: object, options?: Record<string, unknown>) => input.storage.setItem(prefix + key, value, options),
    setItemRaw: (key: string, value: Uint8Array, options?: Record<string, unknown>) => input.storage.setItemRaw(prefix + key, value, options),
  }
  return { _tag: 'Target', storage, baseURL }
}

async function lookupPublishedImage(input: PublishInput, target: PublishTarget): Promise<Published | { _tag: 'Miss' }> {
  if (!(input.maxAgeSeconds > 0))
    return { _tag: 'Miss' }
  const raw = await target.storage.getItem(manifestKey(input))
  const manifest = parseManifest(raw, input.extension)
  if (manifest && manifest.expiresAt > input.now() && await target.storage.hasItem(manifest.objectKey))
    return published(target, manifest.objectKey)
  return { _tag: 'Miss' }
}

function manifestKey(input: PublishInput): string {
  return `manifest:${input.key}.${input.extension}.json`
}

function published(target: PublishTarget, objectKey: string): Published {
  return { _tag: 'Published', objectKey, url: `${target.baseURL}/${objectKey}` }
}

function parseManifest(value: unknown, extension: string): PublishManifest | undefined {
  if (!value || typeof value !== 'object')
    return
  const record = value as Record<string, unknown>
  if (typeof record.objectKey !== 'string' || !new RegExp(`^[a-f0-9]{64}\\.${extension}$`).test(record.objectKey))
    return
  if (typeof record.expiresAt !== 'number' || !Number.isFinite(record.expiresAt))
    return
  return { objectKey: record.objectKey, expiresAt: record.expiresAt }
}
