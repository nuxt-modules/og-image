import type { AddressInfo } from 'node:net'
import type { H3Event } from '#nuxtseo/h3'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { fetchLocalAsset } from '../../src/runtime/server/util/fetchLocalAsset'

vi.mock('#nuxtseo/nitro', () => ({ fetchWithEvent: async () => undefined }))
vi.mock('#nuxtseo/h3', () => ({ getRequestURL: (event: { context: { origin: string } }) => new URL(event.context.origin) }))
vi.mock('#site-config/server/composables', () => ({ getNitroOrigin: (event: { context: { origin: string } }) => event.context.origin }))

describe('local asset external fallback', () => {
  let targetHits = 0
  let origin = ''
  let assetRequest: { path?: string, header?: string } = {}
  const target = createServer((_, response) => {
    targetHits++
    response.end('fixture bytes')
  })
  const app = createServer((request, response) => {
    if (request.url === '/redirect.png') {
      response.writeHead(302, { location: `http://127.0.0.1:${(target.address() as AddressInfo).port}/asset.png` })
      response.end()
      return
    }
    assetRequest = { path: request.url, header: request.headers['x-nuxt-og-image'] as string | undefined }
    response.end('asset bytes')
  })

  beforeAll(async () => {
    for (const server of [target, app]) {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
      })
    }
    origin = `http://127.0.0.1:${(app.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await Promise.all([target, app].map(server => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
    })))
  })

  function event(): H3Event {
    return { context: { origin } } as unknown as H3Event
  }

  it('does not follow a redirect to another local listener', async () => {
    const bytes = await fetchLocalAsset(event(), '/redirect.png', { fetchTimeout: 500, includeExternalFallback: true })
    expect(targetHits).toBe(0)
    expect(bytes).toBeUndefined()
  })

  it('fetches app assets with their query and headers', async () => {
    const bytes = await fetchLocalAsset(event(), '/asset.png?width=32', {
      fetchTimeout: 500,
      includeExternalFallback: true,
      headers: { 'x-nuxt-og-image': '1' },
    })
    expect(new TextDecoder().decode(bytes)).toBe('asset bytes')
    expect(assetRequest).toEqual({ path: '/asset.png?width=32', header: '1' })
  })
})
