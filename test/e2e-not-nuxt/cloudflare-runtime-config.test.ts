import { pathToFileURL } from 'node:url'
import { createResolver } from '@nuxt/kit'
import { exec } from 'tinyexec'
import { beforeAll, describe, expect, it } from 'vitest'
import { ensureLocalModuleStub, extractOgImageUrl } from '../utils'

const { resolve } = createResolver(import.meta.url)
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

  it('maps NUXT_OG_IMAGE_SECRET env bindings into event runtime config', async () => {
    const response = await fetchWorker('/api/runtime-config', {
      NUXT_OG_IMAGE_SECRET: 'cf-secret',
    })
    const body = await response.json()

    expect(body.eventRuntimeConfig.ogImage.secret).toBe('cf-secret')
    expect(body.sharedRuntimeConfig.ogImage.secret).toBe('')
    expect(body.cloudflareEnv.NUXT_OG_IMAGE_SECRET).toBe('cf-secret')
  })

  it('uses the Cloudflare runtime secret when rendering SSR og:image URLs', async () => {
    const response = await fetchWorker('/', {
      NUXT_OG_IMAGE_SECRET: 'cf-secret',
    })
    const html = await response.text()
    const ogImageUrl = extractOgImageUrl(html)

    expect(ogImageUrl).toContain(',s_')
  })
})
