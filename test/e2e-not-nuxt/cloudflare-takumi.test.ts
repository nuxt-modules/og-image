import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
import { execa } from 'execa'
import { globby } from 'globby'
import { configureToMatchImageSnapshot } from 'jest-image-snapshot'
import { $fetch } from 'ofetch'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)
const fixtureDir = resolve('../fixtures/cloudflare-takumi')

const toMatchImageSnapshot = configureToMatchImageSnapshot({
  customDiffConfig: {
    threshold: 0.1,
  },
  failureThresholdType: 'percent',
  failureThreshold: 0.1,
})
expect.extend({ toMatchImageSnapshot })

// Check if takumi WASM is available
let hasTakumiWasm = false
try {
  await import('@takumi-rs/wasm')
  hasTakumiWasm = true
}
catch {
  hasTakumiWasm = false
}

// Check if wrangler is available
let hasWrangler = false
try {
  await execa('npx', ['wrangler', '--version'])
  hasWrangler = true
}
catch {
  hasWrangler = false
}

const canRunTests = hasTakumiWasm && hasWrangler
const isCI = !!process.env.CI

let wranglerProcess: ChildProcess | null = null
let serverUrl = ''

async function buildFixture() {
  await execa('nuxt', ['build'], {
    cwd: fixtureDir,
    env: { ...process.env, NUXT_OG_IMAGE_SKIP_ONBOARDING: '1' },
  })
}

async function startWrangler(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['wrangler', 'dev', '--port', '8788'], {
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

describe('cloudflare-takumi', () => {
  describe.runIf(canRunTests)('prerendered images', () => {
    beforeAll(async () => {
      await buildFixture()
    }, 120000)

    it('generates valid prerendered og images with takumi wasm', async () => {
      const imagePath = resolve(fixtureDir, '.output/public/_og')
      const images = await globby('**/*.png', { cwd: imagePath }).then((r: string[]) => r.sort())

      expect(images.length).toBeGreaterThan(0)

      for (const image of images) {
        const imageBuffer = await fs.readFile(resolve(imagePath, image))
        expect(imageBuffer).toMatchImageSnapshot({
          customSnapshotIdentifier: `cloudflare-takumi-prerender-${image.replace(/\//g, '-').replace('.png', '')}`,
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

    it('serves og images dynamically via wrangler', async () => {
      const html = await $fetch<string>(serverUrl)
      const ogImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
        || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)

      expect(ogImageMatch?.[1]).toBeTruthy()

      const ogImagePath = new URL(ogImageMatch![1]!).pathname
      const image = await $fetch(`${serverUrl}${ogImagePath}`, {
        responseType: 'arrayBuffer' as const,
      })

      expect(Buffer.from(image)).toMatchImageSnapshot({
        customSnapshotIdentifier: 'cloudflare-takumi-wrangler-runtime',
      })
    }, 30000)
  })

  it.runIf(!canRunTests)('skips tests (missing @takumi-rs/wasm or wrangler)', () => {
    expect(true).toBe(true)
  })

  it.runIf(canRunTests && isCI)('skips wrangler runtime in CI (inspector port conflicts)', () => {
    expect(true).toBe(true)
  })
})
