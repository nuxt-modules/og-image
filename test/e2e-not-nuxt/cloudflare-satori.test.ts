import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
import { globby } from 'globby'
import { configureToMatchImageSnapshot } from 'jest-image-snapshot'
import { $fetch } from 'ofetch'
import { exec } from 'tinyexec'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)
const fixtureDir = resolve('../fixtures/cloudflare-satori')

const toMatchImageSnapshot = configureToMatchImageSnapshot({
  customDiffConfig: {
    threshold: 0.1,
  },
  failureThresholdType: 'percent',
  failureThreshold: 0.1,
})
expect.extend({ toMatchImageSnapshot })

// Check if satori deps are available
let hasSatoriDeps = false
try {
  await import('satori')
  await import('@napi-rs/image')
  hasSatoriDeps = true
}
catch {
  hasSatoriDeps = false
}

// Check if wrangler is available
let hasWrangler = false
try {
  await exec('wrangler', ['--version'])
  hasWrangler = true
}
catch {
  hasWrangler = false
}

const canRunTests = hasSatoriDeps && hasWrangler
const isCI = !!process.env.CI

let wranglerProcess: ChildProcess | null = null
let serverUrl = ''

async function buildFixture() {
  await exec('nuxt', ['build'], {
    nodeOptions: {
      cwd: fixtureDir,
      env: { ...process.env, NUXT_OG_IMAGE_SKIP_ONBOARDING: '1' },
    },
  })
}

async function startWrangler(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('wrangler', ['dev', '--port', '8789'], {
      cwd: fixtureDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    wranglerProcess = proc
    let output = ''

    proc.stdout?.on('data', (data) => {
      output += data.toString()
      const match = output.match(/Ready on (http:\/\/\S+)/)
      if (match?.[1]) {
        resolve(match[1])
      }
    })

    proc.stderr?.on('data', (data) => {
      output += data.toString()
    })

    proc.on('error', reject)
    setTimeout(() => reject(new Error(`Wrangler failed to start: ${output}`)), 30000)
  })
}

function stopWrangler() {
  if (wranglerProcess) {
    wranglerProcess.kill()
    wranglerProcess = null
  }
}

describe('cloudflare-satori', () => {
  describe.runIf(canRunTests)('prerendered images', () => {
    beforeAll(async () => {
      await buildFixture()
    }, 120000)

    it('generates valid prerendered og images with satori wasm', async () => {
      const imagePath = resolve(fixtureDir, '.output/public/_og')
      const images = await globby('**/*.png', { cwd: imagePath }).then((r: string[]) => r.sort())

      expect(images.length).toBeGreaterThan(0)

      for (const image of images) {
        const imageBuffer = await fs.readFile(resolve(imagePath, image))
        expect(imageBuffer).toMatchImageSnapshot({
          customSnapshotIdentifier: `cloudflare-satori-prerender-${image.replace(/\//g, '-').replace('.png', '')}`,
        })
      }
    })

    it('includes og:image meta tag in html', async () => {
      const indexHtml = await fs.readFile(resolve(fixtureDir, '.output/public/index.html'), 'utf-8')
      const ogImage = /<meta property="og:image" content="([^"]+)"/.exec(indexHtml)
      expect(ogImage?.[1]).toBeTruthy()
      expect(ogImage?.[1]).toContain('/_og/')
    })
  })

  // Skip wrangler runtime in CI - inspector port 9229 conflicts with other processes
  describe.runIf(canRunTests && !isCI)('wrangler runtime', () => {
    beforeAll(async () => {
      serverUrl = await startWrangler()
    }, 60000)

    afterAll(() => {
      stopWrangler()
    })

    it('serves prerendered og images via wrangler', async () => {
      const html = await $fetch<string>(serverUrl)
      const ogImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
        || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)

      expect(ogImageMatch?.[1]).toBeTruthy()

      const ogImagePath = new URL(ogImageMatch![1]!).pathname
      const image = await $fetch(`${serverUrl}${ogImagePath}`, {
        responseType: 'arrayBuffer' as const,
      })

      expect(Buffer.from(image)).toMatchImageSnapshot({
        customSnapshotIdentifier: 'cloudflare-satori-wrangler-runtime',
      })
    }, 30000)

    it('generates og images dynamically at runtime via wrangler', async () => {
      // Test the dynamic route directly — this exercises the full WASM pipeline
      // (satori yoga init + resvg SVG→PNG) at runtime, not prerendered
      const image = await $fetch(`${serverUrl}/_og/d/image?path=/`, {
        responseType: 'arrayBuffer' as const,
      })

      const buf = Buffer.from(image)
      // Verify it's a valid PNG (magic bytes)
      expect(buf[0]).toBe(0x89)
      expect(buf[1]).toBe(0x50) // P
      expect(buf[2]).toBe(0x4E) // N
      expect(buf[3]).toBe(0x47) // G
      expect(buf.length).toBeGreaterThan(1000)
    }, 30000)
  })

  it.runIf(!canRunTests)('skips tests (missing satori, @napi-rs/image, or wrangler)', () => {
    expect(true).toBe(true)
  })

  it.runIf(canRunTests && isCI)('skips wrangler runtime in CI (inspector port conflicts)', () => {
    expect(true).toBe(true)
  })
})
