import { hkdfSync } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createResolver } from '@nuxt/kit'
import { exec } from 'tinyexec'
import { beforeAll, describe, expect, it } from 'vitest'
import { signEncodedParams } from '../../src/runtime/shared'
import { ensureLocalModuleStub, extractOgImageUrl } from '../utils'

const { resolve } = createResolver(import.meta.url)
const rootSecret = 'cloudflare-root-secret-at-least-32-characters'
const signingSecret = Buffer.from(hkdfSync('sha256', rootSecret, 'nuxt', 'nuxt-og-image:url-signing', 32)).toString('hex')
const fixtureDir = resolve('../fixtures/cloudflare-runtime-config')

async function buildFixture() {
  await ensureLocalModuleStub()
  await exec('nuxt', ['build'], {
    nodeOptions: {
      cwd: fixtureDir,
      env: { ...process.env, NUXT_OG_IMAGE_SKIP_ONBOARDING: '1' },
    },
  })
}

async function fetchWorker(path: string, env: Record<string, unknown>) {
  const workerPath = pathToFileURL(resolve(fixtureDir, '.output/server/index.mjs')).href
  const worker = await import(`${workerPath}?t=${Date.now()}`)
  return await worker.default.fetch(
    new Request(`https://example.com${path}`),
    env,
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  )
}

describe('cloudflare runtime config', () => {
  beforeAll(async () => {
    await buildFixture()
  }, 120000)

  it('maps NUXT_APP_SECRET env bindings into event runtime config', async () => {
    const response = await fetchWorker('/api/runtime-config', {
      NUXT_APP_SECRET: rootSecret,
    })
    const body = await response.json()

    expect(body.eventRuntimeConfig.appSecret).toBe(rootSecret)
    expect(body.sharedRuntimeConfig.appSecret).toBe('')
    expect(body.cloudflareEnv.NUXT_APP_SECRET).toBe(rootSecret)
  })

  it('uses the Cloudflare runtime secret when rendering SSR og:image URLs', async () => {
    const response = await fetchWorker('/', {
      NUXT_APP_SECRET: rootSecret,
    })
    const html = await response.text()
    const ogImageUrl = extractOgImageUrl(html)

    const [, params, signature] = ogImageUrl!.match(/\/_og\/d\/(.+),s_([\w-]+)\.png$/)!
    expect(signature).toBe(signEncodedParams(params, signingSecret))
    expect(html).not.toContain(rootSecret)
    expect(html).not.toContain(signingSecret)
  })

  it.each([undefined, 'short'])('fails closed with an invalid appSecret %s', async (secret) => {
    const response = await fetchWorker('/', secret === undefined ? {} : { NUXT_APP_SECRET: secret })
    expect(response.status).toBe(500)
  })

  it('serves internal $fetch requests and server islands with a binding-only secret', async () => {
    const response = await fetchWorker('/internal-fetch', { NUXT_APP_SECRET: rootSecret })
    const body = await response.text()
    expect(response.status, body).toBe(200)
    expect(body).toContain('world')
    expect(body).toContain('island rendered')
  })

  it('signs getOgImageUrl with the Cloudflare runtime secret', async () => {
    const env = { NUXT_APP_SECRET: rootSecret }
    const response = await fetchWorker('/api/og-url', env)
    const { url } = await response.json() as { url: string }

    const parsed = new URL(url)
    // Same origin the app side uses for the page's og:image.
    const html = await (await fetchWorker('/', env)).text()
    const ogImage = html.match(/property="og:image" content="([^"]+)"/)?.[1]
    expect(parsed.origin).toBe(new URL(ogImage!).origin)
    const [, params, signature] = parsed.pathname.match(/\/_og\/d\/(.+),s_([\w-]+)\.png$/)!
    expect(signature).toBe(signEncodedParams(params, signingSecret))

    // satori is not bundled in this fixture, so rendering fails after
    // verification. Only the signature check matters here.
    const image = await fetchWorker(parsed.pathname, env)
    expect(image.status).not.toBe(403)
    const tampered = await fetchWorker(parsed.pathname.replace(/,s_[\w-]+\.png$/, ',s_AAAAAAAAAAAAAAAA.png'), env)
    expect(tampered.status, await tampered.text()).toBe(403)
  })
})
