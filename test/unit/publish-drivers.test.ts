import { createStorage } from 'unstorage'
import r2Driver from 'unstorage/drivers/cloudflare-r2-binding'
import s3Driver from 'unstorage/drivers/s3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPublishedImage, publishImage } from '../../src/runtime/server/og-image/cache/publish'

afterEach(() => vi.unstubAllGlobals())

function input(storage: ReturnType<typeof createStorage>) {
  return {
    storage,
    mount: 'public',
    baseURL: 'https://images.example.com',
    key: 'driver-test',
    extension: 'png' as const,
    maxAgeSeconds: 60,
    now: () => 1000,
    render: async () => new Uint8Array([1, 2, 3]),
  }
}

describe('publish storage drivers', () => {
  it('publishes raw bytes and HTTP metadata through an R2 binding', async () => {
    const objects = new Map<string, Uint8Array>()
    const put = vi.fn(async (key: string, value: BodyInit) => {
      objects.set(key, new Uint8Array(await new Response(value).arrayBuffer()))
    })
    const binding = {
      put,
      head: async (key: string) => objects.has(key) ? {} : null,
      get: async (key: string) => objects.has(key) ? { text: async () => new TextDecoder().decode(objects.get(key)) } : null,
      delete: async (key: string) => { objects.delete(key) },
    }
    const storage = createStorage().mount('public', r2Driver({ binding: binding as any }))
    const result = await publishImage(input(storage))
    expect(result._tag).toBe('Published')
    if (result._tag !== 'Published')
      throw new Error('Expected publication')
    expect(objects.get(result.objectKey)).toEqual(new Uint8Array([1, 2, 3]))
    expect(put.mock.calls[0]).toEqual([
      result.objectKey,
      new Uint8Array([1, 2, 3]),
      { httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' } },
    ])
    expect(await getPublishedImage(input(storage))).toEqual(result)
  })

  it('publishes signed PUT requests and reuses the manifest through the S3 driver', async () => {
    const objects = new Map<string, Uint8Array>()
    const transport = vi.fn(async (request: Request) => {
      const key = new URL(request.url).pathname
      expect(request.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 /)
      if (request.method === 'PUT') {
        objects.set(key, new Uint8Array(await request.arrayBuffer()))
        return new Response(null, { status: 200 })
      }
      const bytes = objects.get(key)
      return bytes ? new Response(request.method === 'HEAD' ? null : new Uint8Array(bytes), { status: 200 }) : new Response(null, { status: 404 })
    })
    vi.stubGlobal('fetch', transport)
    const storage = createStorage().mount('public', s3Driver({
      endpoint: 'https://s3.example.com',
      bucket: 'images',
      region: 'auto',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
    }))
    const result = await publishImage(input(storage))
    expect(result._tag).toBe('Published')
    if (result._tag !== 'Published')
      throw new Error('Expected publication')
    expect(objects.get(`/images/${result.objectKey}`)).toEqual(new Uint8Array([1, 2, 3]))
    expect(await getPublishedImage(input(storage))).toEqual(result)
    const puts = transport.mock.calls.filter(([request]) => request.method === 'PUT')
    expect(puts).toHaveLength(2)
  })
})
