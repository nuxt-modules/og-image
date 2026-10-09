import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { describe, expect, it, vi } from 'vitest'
import { getPublishedImage, getPublishKey, publishImage } from '../../src/runtime/server/og-image/cache/publish'

function setup() {
  const storage = createStorage()
  storage.mount('public', memoryDriver())
  const render = vi.fn(async () => new Uint8Array([1, 2, 3]))
  const input = { storage, mount: 'public', baseURL: 'https://files.example.com/og', key: 'options-hash', extension: 'png' as const, maxAgeSeconds: 60, now: () => 1000, render }
  return { storage, render, input }
}

describe('publishImage', () => {
  it('publishes raw bytes and reuses an unexpired manifest without rendering', async () => {
    const { storage, render, input } = setup()
    const first = await publishImage(input)
    expect(first._tag).toBe('Published')
    if (first._tag !== 'Published')
      throw new Error('Expected publication')
    expect(await storage.getItemRaw(`public:${first.objectKey}`)).toEqual(new Uint8Array([1, 2, 3]))
    expect(await publishImage(input)).toEqual(first)
    expect(render).toHaveBeenCalledTimes(1)
    expect(first.url).toBe(`https://files.example.com/og/${first.objectKey}`)
  })

  it('renders at expiry and retains the previous immutable object', async () => {
    const { storage, render, input } = setup()
    const first = await publishImage(input)
    render.mockResolvedValue(new Uint8Array([4, 5, 6]))
    const second = await publishImage({ ...input, now: () => 61000 })
    expect(render).toHaveBeenCalledTimes(2)
    expect(second).not.toEqual(first)
    if (first._tag !== 'Published' || second._tag !== 'Published')
      throw new Error('Expected publication')
    expect(await storage.getItemRaw(`public:${first.objectKey}`)).toEqual(new Uint8Array([1, 2, 3]))
    expect(await storage.getItemRaw(`public:${second.objectKey}`)).toEqual(new Uint8Array([4, 5, 6]))
  })

  it('recreates an object deleted before the manifest expires', async () => {
    const { storage, render, input } = setup()
    const first = await publishImage(input)
    if (first._tag !== 'Published')
      throw new Error('Expected publication')
    await storage.removeItem(`public:${first.objectKey}`)
    expect(await publishImage(input)).toEqual(first)
    expect(render).toHaveBeenCalledTimes(2)
    expect(await storage.hasItem(`public:${first.objectKey}`)).toBe(true)
  })

  it('does not reuse images when caching is disabled', async () => {
    const { render, input } = setup()
    await publishImage({ ...input, maxAgeSeconds: 0 })
    await publishImage({ ...input, maxAgeSeconds: 0 })
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('falls back for a missing mount without writing into default memory storage', async () => {
    const { storage, render, input } = setup()
    const result = await publishImage({ ...input, mount: 'missing' })
    expect(result._tag).toBe('Unavailable')
    expect(render).not.toHaveBeenCalled()
    expect(await storage.getKeys()).toEqual([])
  })

  it('falls back if the object upload fails without writing a successful manifest', async () => {
    const { storage, input } = setup()
    vi.spyOn(storage, 'setItemRaw').mockRejectedValue(new Error('Bucket unavailable'))
    const result = await publishImage(input)
    expect(result._tag).toBe('Unavailable')
    expect(await storage.getKeys()).toEqual([])
  })

  it('falls back if storage does not complete within the render timeout', async () => {
    const { storage, input, render } = setup()
    vi.spyOn(storage, 'getItem').mockReturnValue(new Promise(() => {}))
    expect((await publishImage({ ...input, timeoutMs: 1 }))._tag).toBe('Unavailable')
    expect(render).not.toHaveBeenCalled()
  })

  it.each(['invalid', 'https://files.example.com/og?', 'https://files.example.com/og#', 'https://files.example.com/og?token=secret', 'https://user:secret@files.example.com/og'])('keeps local URLs for invalid public origins: %s', async (baseURL) => {
    const { input, render } = setup()
    expect((await publishImage({ ...input, baseURL }))._tag).toBe('Unavailable')
    expect(render).not.toHaveBeenCalled()
  })

  it('repairs a corrupt manifest instead of emitting its object URL', async () => {
    const { storage, input, render } = setup()
    await storage.setItem('public:manifest:options-hash.png.json', { objectKey: '../../not-an-image', expiresAt: 999999 })
    const result = await publishImage(input)
    expect(result._tag).toBe('Published')
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('expires only the manifest and passes image HTTP metadata to the driver', async () => {
    const { storage, input } = setup()
    const upload = vi.spyOn(storage, 'setItemRaw')
    const manifest = vi.spyOn(storage, 'setItem')
    await publishImage({ ...input, maxAgeSeconds: 1 })
    expect(upload.mock.calls[0]![2]).toEqual({
      httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' },
    })
    expect(manifest.mock.calls[0]![2]).toEqual({ ttl: 60 })
  })

  it('uses an app URL once the manifest expires or the public object disappears', async () => {
    const { storage, input } = setup()
    const result = await publishImage(input)
    expect(await getPublishedImage(input)).toEqual(result)
    expect(await getPublishedImage({ ...input, now: () => 61000 })).toEqual({ _tag: 'Miss' })
    if (result._tag !== 'Published')
      throw new Error('Expected publication')
    await storage.removeItem(`public:${result.objectKey}`)
    expect(await getPublishedImage(input)).toEqual({ _tag: 'Miss' })
  })

  it('publishes fresh runtime bytes even while an older object is reusable', async () => {
    const { storage, input, render } = setup()
    const old = await publishImage(input)
    render.mockResolvedValue(new Uint8Array([4, 5, 6]))
    const fresh = await publishImage({ ...input, force: true })
    expect(fresh).not.toEqual(old)
    expect(await getPublishedImage(input)).toEqual(fresh)
    if (old._tag !== 'Published')
      throw new Error('Expected publication')
    expect(await storage.getItemRaw(`public:${old.objectKey}`)).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('matches signed and escaped image requests without sharing changed defaults or versions', () => {
    const plain = getPublishKey('https://site.example/_og/d/c_Test,title_Hello.png', { width: 1200 }, 'v1')
    expect(getPublishKey('https://site.example/_og/d/c_Test%2Ctitle_Hello%2Cs_signature.png', { width: 1200 }, 'v1')).toBe(plain)
    expect(getPublishKey('https://site.example/_og/d/c_Test,title_Hello.png', { width: 600 }, 'v1')).not.toBe(plain)
    expect(getPublishKey('https://site.example/_og/d/c_Test,title_Hello.png', { width: 1200 }, 'v2')).not.toBe(plain)
    expect(getPublishKey('https://other.example/_og/d/c_Test,title_Hello.png', { width: 1200 }, 'v1')).not.toBe(plain)
  })

  it('preserves buffer expiry even if publication completes later', async () => {
    const { input } = setup()
    await publishImage({ ...input, force: true, expiresAt: 5000, now: () => 4900 })
    expect((await getPublishedImage({ ...input, now: () => 4999 }))._tag).toBe('Published')
    expect(await getPublishedImage({ ...input, now: () => 5000 })).toEqual({ _tag: 'Miss' })
  })
})
