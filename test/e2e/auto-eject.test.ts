import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createResolver } from '@nuxt/kit'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { encodeOgImageParams } from '../../src/runtime/shared/urlEncoding'
import { waitFor } from '../utils'

const { resolve } = createResolver(import.meta.url)

const fixtureRoot = resolve('../fixtures/auto-eject')
const ogDir = join(fixtureRoot, 'components/OgImage')

describe.skipIf(!import.meta.env?.TEST_DEV)('auto-eject', async () => {
  rmSync(join(fixtureRoot, 'components'), { recursive: true, force: true })
  await setup({
    rootDir: fixtureRoot,
    dev: true,
  })

  // The dev server answers 503 while Vite optimises dependencies.
  beforeAll(async () => {
    await waitFor(async () => (await fetch('/_og/debug.json')).status !== 503, { timeout: 60000 })
  }, 90000)

  afterAll(() => {
    rmSync(join(fixtureRoot, 'components'), { recursive: true, force: true })
  })

  it('does not eject a template that only DevTools previews', async () => {
    const encoded = encodeOgImageParams({ component: 'BlogPost.takumi', _path: '/' })
    const res = await fetch(`/_og/d/${encoded}.png?timestamp=1`)
    expect(res.status).toBe(200)
    expect(existsSync(join(ogDir, 'BlogPost.takumi.vue'))).toBe(false)
  }, 60000)

  it('ejects the requested variant when a page renders a community template', async () => {
    const html = await $fetch('/') as string
    expect(html).toContain('Auto eject')
    await waitFor(async () => existsSync(join(ogDir, 'NuxtSeo.takumi.vue')))
    expect(existsSync(join(ogDir, 'NuxtSeo.satori.vue'))).toBe(false)
  }, 60000)
})
