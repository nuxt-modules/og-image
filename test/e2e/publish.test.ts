import { readdir, readFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { join } from 'pathe'
import sharp from 'sharp'
import { exec } from 'tinyexec'
import { describe, expect, it } from 'vitest'

const rootDir = fileURLToPath(new URL('../fixtures/publish', import.meta.url))
const publishedDir = join(rootDir, '.data/published')
await rm(publishedDir, { recursive: true, force: true })
await setup({ rootDir, server: true, build: true })

describe('prerender publishing', () => {
  it('emits the public image URL with actual PNG bytes in storage', async () => {
    const html = await $fetch('/')
    const url = html.match(/property="og:image" content="([^"]+)"/)![1]!
    expect(url).toMatch(/^https:\/\/files\.example\.com\/og\/[a-f0-9]{64}\.png$/)
    const bytes = await readFile(join(publishedDir, url.split('/').pop()!))
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(html).toContain(`name="twitter:image" content="${url}"`)
    expect(html).not.toContain('/_og/s/')
  })

  it('publishes every image on a page without losing metadata', async () => {
    const html = await $fetch('/multiple')
    const urls = [...html.matchAll(/property="og:image" content="([^"]+)"/g)].map(match => match[1]!)
    expect(urls).toHaveLength(2)
    expect(new Set(urls).size).toBe(2)
    for (const url of urls) {
      const bytes = await readFile(join(publishedDir, url.split('/').pop()!))
      expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    }
    expect(html).toContain('og:image:width')
  })

  it('publishes a runtime image and switches later SSR pages to its public URL', async () => {
    const before = await $fetch('/runtime')
    const appURL = before.match(/property="og:image" content="([^"]+)"/)![1]!
    expect(appURL).toContain('/_og/d/')
    const response = await fetch(new URL(appURL).pathname)
    expect(response.status).toBe(200)
    const generated = new Uint8Array(await response.arrayBuffer())
    expect([...generated.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])

    const after = await $fetch('/runtime')
    const publicURL = after.match(/property="og:image" content="([^"]+)"/)![1]!
    expect(publicURL).toMatch(/^https:\/\/files\.example\.com\/og\/[a-f0-9]{64}\.png$/)
    expect(await readFile(join(publishedDir, publicURL.split('/').pop()!))).toEqual(Buffer.from(generated))
    expect(after).toContain(`name="twitter:image" content="${publicURL}"`)

    const manifestFiles = await readdir(join(publishedDir, 'manifest'))
    const manifestEntries = await Promise.all(manifestFiles.map(async file => ({ file, value: JSON.parse(await readFile(join(publishedDir, 'manifest', file), 'utf8')) })))
    const manifest = manifestEntries.find(entry => entry.value.objectKey === publicURL.split('/').pop())!
    await rm(join(publishedDir, manifest.value.objectKey))
    expect(await $fetch('/runtime')).toContain(`property="og:image" content="${appURL}"`)
    const cached = await fetch(new URL(appURL).pathname)
    expect(cached.headers.get('x-og-cache')).toBe('HIT')
    const republished = JSON.parse(await readFile(join(publishedDir, 'manifest', manifest.file), 'utf8'))
    expect(republished.expiresAt).toBe(manifest.value.expiresAt)
    expect(await $fetch('/runtime')).toContain(`property="og:image" content="${publicURL}"`)
  })

  it.runIf(process.env.HAS_CHROME)('publishes a page screenshot without recursive page rendering', async () => {
    const html = await $fetch('/screenshot')
    const url = html.match(/property="og:image" content="([^"]+)"/)![1]!
    expect(url).toMatch(/^https:\/\/files\.example\.com\/og\/[a-f0-9]{64}\.jpeg$/)
    const bytes = await readFile(join(publishedDir, url.split('/').pop()!))
    expect([...bytes.subarray(0, 3)]).toEqual([255, 216, 255])
    const pixel = await sharp(bytes).extract({ left: 20, top: 20, width: 1, height: 1 }).raw().toBuffer()
    for (const [channel, expected] of [220, 20, 60].entries())
      expect(Math.abs(pixel[channel]! - expected)).toBeLessThanOrEqual(2)
  })

  it('retains an expiring manifest for subsequent builds', async () => {
    const html = await $fetch('/')
    const objectKey = html.match(/property="og:image" content="([^"]+)"/)![1]!.split('/').pop()!
    const files = await readdir(join(publishedDir, 'manifest'))
    const manifests = await Promise.all(files.map(async file => JSON.parse(await readFile(join(publishedDir, 'manifest', file), 'utf8'))))
    const manifest = manifests.find(value => value.objectKey === objectKey)!
    expect(manifest.expiresAt).toBeGreaterThan(Date.now())
    const bytes = await readFile(join(publishedDir, manifest.objectKey))
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  })

  it('reuses published images on the next build and keeps local images if the mount is missing', async () => {
    await exec('pnpm', ['exec', 'nuxt', 'build', rootDir], {
      throwOnError: true,
      nodeOptions: { env: { ...process.env, OG_IMAGE_TEST_BLOCK_RENDER: 'true' } },
    })
    const reused = await readFile(join(rootDir, '.output/public/index.html'), 'utf8')
    expect(reused).toMatch(/property="og:image" content="https:\/\/files\.example\.com\/og\/[a-f0-9]{64}\.png"/)
    expect(reused).not.toContain('/_og/s/')

    await exec('pnpm', ['exec', 'nuxt', 'build', rootDir], {
      throwOnError: true,
      nodeOptions: { env: { ...process.env, OG_IMAGE_TEST_MISSING_MOUNT: 'true', OG_IMAGE_TEST_BASE_URL: '/prefix/' } },
    })
    const fallback = await readFile(join(rootDir, '.output/public/index.html'), 'utf8')
    const url = fallback.match(/property="og:image" content="([^"]+)"/)![1]!
    expect(url).toMatch(/^https:\/\/assets\.example\.com\/static\/_og\/s\//)
    expect(url).not.toContain('/prefix/')
    expect(fallback).toContain(`name="twitter:image" content="${url}"`)
    const bytes = await readFile(join(rootDir, '.output/public', new URL(url).pathname.replace('/static/', '/')))
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  }, 120000)

  it('uses the asset CDN without enabling bucket publishing', async () => {
    await exec('pnpm', ['exec', 'nuxt', 'build', rootDir], {
      throwOnError: true,
      nodeOptions: { env: { ...process.env, OG_IMAGE_TEST_DISABLE_PUBLISH: 'true', OG_IMAGE_TEST_BASE_URL: '/prefix/' } },
    })
    const html = await readFile(join(rootDir, '.output/public/index.html'), 'utf8')
    const url = html.match(/property="og:image" content="([^"]+)"/)![1]!
    expect(url).toMatch(/^https:\/\/assets\.example\.com\/static\/_og\/s\//)
    expect(html).toContain(`name="twitter:image" content="${url}"`)
    const bytes = await readFile(join(rootDir, '.output/public', new URL(url).pathname.replace('/static/', '/')))
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  }, 120000)
})
